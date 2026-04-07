import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { pool, closePool } from './pool';
import { logger } from '../lib/logger';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const appliedVersions = new Set(applied.map((r) => r.version));

    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const version = file.replace('.sql', '');

      if (appliedVersions.has(version)) {
        logger.info({ version }, 'Migration already applied, skipping');
        continue;
      }

      logger.info({ version }, 'Applying migration');
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        logger.info({ version }, 'Migration applied successfully');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    logger.info('All migrations applied');
  } finally {
    client.release();
    await closePool();
  }
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
