import { EntryRepository } from '../db/repositories/entry-repository';
import { SenseRepository } from '../db/repositories/sense-repository';
import { pool } from '../db/pool';
import { logger } from '../lib/logger';

export async function reindex(): Promise<void> {
  logger.info('Rebuilding entry_forms lookup table...');
  await pool.query('TRUNCATE entry_forms');
  await pool.query(`
    INSERT INTO entry_forms (entry_id, form, form_normalized, tags)
    SELECT
      e.id,
      f->>'form',
      lower(trim(f->>'form')),
      ARRAY(SELECT jsonb_array_elements_text(f->'tags'))
    FROM entries e, jsonb_array_elements(e.forms) AS f
    WHERE e.forms IS NOT NULL
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM entry_forms');
  logger.info({ count: rows[0].count }, 'entry_forms populated');

  logger.info('Reindexing tables...');

  const entryRepo = new EntryRepository(pool);
  const senseRepo = new SenseRepository(pool);

  await entryRepo.reindex();
  logger.info('Entries reindexed');

  await senseRepo.reindex();
  logger.info('Senses reindexed');

  logger.info('Reindex complete');
}
