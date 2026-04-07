import { pool } from '../db/pool';
import { EntryRepository } from '../db/repositories/entry-repository';
import { SenseRepository } from '../db/repositories/sense-repository';
import { createJsonlReader } from '../lib/streams';
import { KaikkiRecordSchema } from '../domain/schemas/kaikki';
import { mapKaikkiRecord, MappedEntry } from '../domain/mappers/kaikki-mapper';
import { logger } from '../lib/logger';

const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 10_000;

export interface ImportStats {
  totalLines: number;
  totalEntriesInserted: number;
  totalSensesInserted: number;
  totalSkipped: number;
  totalErrors: number;
  durationMs: number;
}

export async function importKaikki(filePath: string): Promise<ImportStats> {
  const entryRepo = new EntryRepository(pool);
  const senseRepo = new SenseRepository(pool);

  const stats: ImportStats = {
    totalLines: 0,
    totalEntriesInserted: 0,
    totalSensesInserted: 0,
    totalSkipped: 0,
    totalErrors: 0,
    durationMs: 0,
  };

  const startTime = Date.now();
  let batch: MappedEntry[] = [];

  logger.info({ filePath }, 'Starting import');

  for await (const line of createJsonlReader(filePath)) {
    stats.totalLines++;

    if (!line.trim()) {
      stats.totalSkipped++;
      continue;
    }

    // Parse JSON
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      stats.totalErrors++;
      if (stats.totalErrors <= 10) {
        logger.warn({ line: stats.totalLines }, 'Malformed JSON, skipping');
      }
      continue;
    }

    // Validate with zod
    const parsed = KaikkiRecordSchema.safeParse(raw);
    if (!parsed.success) {
      stats.totalErrors++;
      if (stats.totalErrors <= 10) {
        logger.warn(
          { line: stats.totalLines, error: parsed.error.message },
          'Validation failed, skipping',
        );
      }
      continue;
    }

    // Map to domain model
    const mapped = mapKaikkiRecord(parsed.data);
    if (!mapped) {
      stats.totalSkipped++;
      continue;
    }

    batch.push(mapped);

    if (batch.length >= BATCH_SIZE) {
      const result = await flushBatch(batch, entryRepo, senseRepo);
      stats.totalEntriesInserted += result.entries;
      stats.totalSensesInserted += result.senses;
      batch = [];
    }

    if (stats.totalLines % PROGRESS_INTERVAL === 0) {
      logger.info(
        {
          linesRead: stats.totalLines,
          entriesInserted: stats.totalEntriesInserted,
          sensesInserted: stats.totalSensesInserted,
          errors: stats.totalErrors,
        },
        'Import progress',
      );
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const result = await flushBatch(batch, entryRepo, senseRepo);
    stats.totalEntriesInserted += result.entries;
    stats.totalSensesInserted += result.senses;
  }

  stats.durationMs = Date.now() - startTime;

  logger.info(
    {
      ...stats,
      durationSec: (stats.durationMs / 1000).toFixed(1),
    },
    'Import complete',
  );

  return stats;
}

async function flushBatch(
  batch: MappedEntry[],
  entryRepo: EntryRepository,
  senseRepo: SenseRepository,
): Promise<{ entries: number; senses: number }> {
  const client = await pool.connect();
  let entries = 0;
  let senses = 0;

  try {
    await client.query('BEGIN');

    for (const mapped of batch) {
      const entryId = await entryRepo.upsert(mapped.entry, client);
      const count = await senseRepo.replaceForEntry(
        entryId,
        mapped.senses,
        client,
      );
      entries++;
      senses += count;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Batch insert failed');
    throw err;
  } finally {
    client.release();
  }

  return { entries, senses };
}
