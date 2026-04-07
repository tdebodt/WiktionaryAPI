import { Pool, PoolClient } from 'pg';
import { Entry, NewEntry } from '../../domain/models/entry';
import { normalizeLemma } from '../../lib/normalize';

const ENTRY_COLUMNS = `e.id, e.lemma, e.lemma_normalized, e.lang_code, e.lang_name, e.pos,
              e.etymology_index, e.source_word, e.forms, e.created_at, e.updated_at`;

export class EntryRepository {
  constructor(private pool: Pool) {}

  /**
   * Upsert an entry and store raw JSON in entries_raw.
   * ON CONFLICT handles idempotent re-imports.
   */
  async upsert(entry: NewEntry, client?: PoolClient): Promise<number> {
    const conn = client ?? this.pool;
    const { rows } = await conn.query<{ id: number }>(
      `INSERT INTO entries
         (lemma, lemma_normalized, lang_code, lang_name, pos, etymology_index, source_word, forms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (lemma_normalized, lang_code, pos, etymology_index)
       DO UPDATE SET
         lemma = EXCLUDED.lemma,
         lang_name = EXCLUDED.lang_name,
         source_word = EXCLUDED.source_word,
         forms = EXCLUDED.forms,
         updated_at = NOW()
       RETURNING id`,
      [
        entry.lemma,
        entry.lemmaNormalized,
        entry.langCode,
        entry.langName,
        entry.pos,
        entry.etymologyIndex,
        entry.sourceWord,
        entry.forms ? JSON.stringify(entry.forms) : null,
      ],
    );

    const entryId = rows[0].id;

    // Store raw JSON in separate table
    if (entry.rawEntryJson) {
      await conn.query(
        `INSERT INTO entries_raw (entry_id, raw_json) VALUES ($1, $2)
         ON CONFLICT (entry_id) DO UPDATE SET raw_json = EXCLUDED.raw_json`,
        [entryId, JSON.stringify(entry.rawEntryJson)],
      );
    }

    return entryId;
  }

  async findByNormalizedLemma(
    lemma: string,
    langCode?: string,
    pos?: string,
  ): Promise<Entry[]> {
    const normalized = normalizeLemma(lemma);

    const filters: string[] = [];
    const params: unknown[] = [normalized];

    if (langCode) {
      params.push(langCode);
      filters.push(`e.lang_code = $${params.length}`);
    }
    if (pos) {
      params.push(pos);
      filters.push(`e.pos = $${params.length}`);
    }

    const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

    const { rows } = await this.pool.query(
      `WITH matched_ids AS (
         SELECT id FROM entries WHERE lemma_normalized = $1
         UNION
         SELECT entry_id FROM entry_forms WHERE form_normalized = $1
       )
       SELECT ${ENTRY_COLUMNS}
       FROM entries e
       JOIN matched_ids m ON e.id = m.id
       WHERE true ${filterClause}
       ORDER BY e.etymology_index, e.pos`,
      params,
    );

    return rows.map(rowToEntry);
  }

  async searchByPrefix(
    query: string,
    langCode?: string,
    pos?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Entry[]> {
    const normalized = normalizeLemma(query);

    const filters: string[] = [];
    const params: unknown[] = [`${normalized}%`];

    if (langCode) {
      params.push(langCode);
      filters.push(`e.lang_code = $${params.length}`);
    }
    if (pos) {
      params.push(pos);
      filters.push(`e.pos = $${params.length}`);
    }

    params.push(limit);
    params.push(offset);

    const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

    const { rows } = await this.pool.query(
      `WITH matched_ids AS (
         SELECT id FROM entries WHERE lemma_normalized LIKE $1
         UNION
         SELECT entry_id FROM entry_forms WHERE form_normalized LIKE $1
       )
       SELECT DISTINCT ON (e.lemma_normalized, e.lang_code, e.pos)
              ${ENTRY_COLUMNS}
       FROM entries e
       JOIN matched_ids m ON e.id = m.id
       WHERE true ${filterClause}
       ORDER BY e.lemma_normalized, e.lang_code, e.pos, e.etymology_index
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return rows.map(rowToEntry);
  }

  async findById(id: number): Promise<Entry | null> {
    const { rows } = await this.pool.query(
      `SELECT ${ENTRY_COLUMNS} FROM entries e WHERE e.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToEntry(rows[0]) : null;
  }

  async totalCount(): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM entries',
    );
    return rows[0].count;
  }

  async reindex(): Promise<void> {
    await this.pool.query('REINDEX TABLE entries');
    await this.pool.query('REINDEX TABLE entries_raw');
    await this.pool.query('ANALYZE entries');
    await this.pool.query('ANALYZE entries_raw');
  }
}

function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id: row.id as number,
    lemma: row.lemma as string,
    lemmaNormalized: row.lemma_normalized as string,
    langCode: row.lang_code as string,
    langName: row.lang_name as string | null,
    pos: row.pos as string,
    etymologyIndex: row.etymology_index as number,
    sourceWord: row.source_word as string | null,
    forms: row.forms as Entry['forms'],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
