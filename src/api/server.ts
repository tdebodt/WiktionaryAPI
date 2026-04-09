import { config } from '../lib/config';
import { logger } from '../lib/logger';
import { pool, closePool } from '../db/pool';
import { createApp } from './app';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp(pool);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  logger.info('HTTP server closed');

  await closePool();
  logger.info('Database pool closed');

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
