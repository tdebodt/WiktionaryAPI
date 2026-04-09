import { Pool } from 'pg';
import { config } from '../lib/config';
import { logger } from '../lib/logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: config.dbStatementTimeoutMs,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

export async function closePool(): Promise<void> {
  await pool.end();
}
