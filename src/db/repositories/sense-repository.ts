import { Pool, PoolClient } from 'pg';
import { Sense } from '../../domain/models/sense';

const SENSE_COLUMNS = 'id, entry_id, sense_index, gloss, tags, topics, categories, examples_text';

export class SenseRepository {
  constructor(private pool: Pool) {}

  /**
   * Replace all senses for an entry: delete existing, insert new.
   * Raw JSON goes into senses_raw. Call within a transaction for atomicity.
   */
  async replaceForEntry(
    entryId: number,
    senses: Array<{
      senseIndex: number;
      gloss: string;
      tags: string[] | null;
      topics: string[] | null;
      categories: string[] | null;
      examplesText: string[] | null;
      rawSenseJson: Record<string, unknown> | null;
    }>,
    client?: PoolClient,
  ): Promise<number> {
    const conn = client ?? this.pool;

    await conn.query('DELETE FROM senses WHERE entry_id = $1', [entryId]);

    if (senses.length === 0) return 0;

    // Insert senses (without raw JSON)
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < senses.length; i++) {
      const s = senses[i];
      const base = i * 7;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
      );
      values.push(
        entryId,
        s.senseIndex,
        s.gloss,
        s.tags,
        s.topics,
        s.categories,
        s.examplesText,
      );
    }

    const { rows: inserted } = await conn.query<{ id: number }>(
      `INSERT INTO senses (entry_id, sense_index, gloss, tags, topics, categories, examples_text)
       VALUES ${placeholders.join(', ')}
       RETURNING id`,
      values,
    );

    // Store raw JSON in separate table
    const rawValues: unknown[] = [];
    const rawPlaceholders: string[] = [];
    let rawIdx = 0;

    for (let i = 0; i < senses.length; i++) {
      if (senses[i].rawSenseJson) {
        const base = rawIdx * 2;
        rawPlaceholders.push(`($${base + 1}, $${base + 2})`);
        rawValues.push(inserted[i].id, JSON.stringify(senses[i].rawSenseJson));
        rawIdx++;
      }
    }

    if (rawPlaceholders.length > 0) {
      await conn.query(
        `INSERT INTO senses_raw (sense_id, raw_json) VALUES ${rawPlaceholders.join(', ')}`,
        rawValues,
      );
    }

    return senses.length;
  }

  async findByEntryId(entryId: number): Promise<Sense[]> {
    const { rows } = await this.pool.query(
      `SELECT ${SENSE_COLUMNS} FROM senses WHERE entry_id = $1 ORDER BY sense_index`,
      [entryId],
    );
    return rows.map(rowToSense);
  }

  async findByEntryIds(entryIds: number[]): Promise<Map<number, Sense[]>> {
    if (entryIds.length === 0) return new Map();

    const { rows } = await this.pool.query(
      `SELECT ${SENSE_COLUMNS} FROM senses WHERE entry_id = ANY($1) ORDER BY entry_id, sense_index`,
      [entryIds],
    );

    const grouped = new Map<number, Sense[]>();
    for (const row of rows) {
      const sense = rowToSense(row);
      const list = grouped.get(sense.entryId) ?? [];
      list.push(sense);
      grouped.set(sense.entryId, list);
    }
    return grouped;
  }

  async findById(id: number): Promise<Sense | null> {
    const { rows } = await this.pool.query(
      `SELECT ${SENSE_COLUMNS} FROM senses WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToSense(rows[0]) : null;
  }

  async totalCount(): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM senses',
    );
    return rows[0].count;
  }

  async reindex(): Promise<void> {
    await this.pool.query('REINDEX TABLE senses');
    await this.pool.query('REINDEX TABLE senses_raw');
    await this.pool.query('ANALYZE senses');
    await this.pool.query('ANALYZE senses_raw');
  }
}

function rowToSense(row: Record<string, unknown>): Sense {
  return {
    id: row.id as number,
    entryId: row.entry_id as number,
    senseIndex: row.sense_index as number,
    gloss: row.gloss as string,
    tags: row.tags as string[] | null,
    topics: row.topics as string[] | null,
    categories: row.categories as string[] | null,
    examplesText: row.examples_text as string[] | null,
  };
}
