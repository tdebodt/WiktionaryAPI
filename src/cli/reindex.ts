import { EntryRepository } from '../db/repositories/entry-repository';
import { SenseRepository } from '../db/repositories/sense-repository';
import { pool } from '../db/pool';
import { logger } from '../lib/logger';

export async function reindex(): Promise<void> {
  logger.info('Reindexing tables...');

  const entryRepo = new EntryRepository(pool);
  const senseRepo = new SenseRepository(pool);

  await entryRepo.reindex();
  logger.info('Entries reindexed');

  await senseRepo.reindex();
  logger.info('Senses reindexed');

  logger.info('Reindex complete');
}
