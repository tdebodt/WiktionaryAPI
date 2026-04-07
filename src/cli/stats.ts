import { pool } from '../db/pool';

export async function showStats(): Promise<void> {
  const entryCount = await pool.query(
    'SELECT COUNT(*)::int AS count FROM entries',
  );
  const senseCount = await pool.query(
    'SELECT COUNT(*)::int AS count FROM senses',
  );

  const langStats = await pool.query(`
    SELECT lang_code, COUNT(*)::int AS count
    FROM entries
    GROUP BY lang_code
    ORDER BY count DESC
  `);

  const posStats = await pool.query(`
    SELECT pos, COUNT(*)::int AS count
    FROM entries
    WHERE pos != ''
    GROUP BY pos
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('\n=== Database Statistics ===\n');
  console.log(`Total entries: ${entryCount.rows[0].count}`);
  console.log(`Total senses:  ${senseCount.rows[0].count}`);

  console.log('\nEntries by language:');
  for (const row of langStats.rows) {
    console.log(`  ${row.lang_code}: ${row.count}`);
  }

  console.log('\nEntries by part of speech:');
  for (const row of posStats.rows) {
    console.log(`  ${row.pos}: ${row.count}`);
  }

  console.log('');
}
