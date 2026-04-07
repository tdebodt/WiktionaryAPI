import { config } from '../lib/config';
import { logger } from '../lib/logger';
import { pool, closePool } from '../db/pool';
import { createApp } from './app';

const app = createApp(pool);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
