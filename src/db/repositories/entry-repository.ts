import { Pool, PoolClient } from 'pg';
import { Entry, NewEntry } from '../../domain/models/entry';
import { normalizeLemma, generateEntryId } from '../../lib/normalize';

const ENTRY_COLUMNS = `e.id, e.stable_id, e.lemma, e.lemma_normalized, e.lang_code, e.lang_name, e.pos,
              e.etymology_index, e.source_edition, e.source_word, e.forms, e.created_at, e.updated_at`;

export class EntryRepository {
  constructor(private pool: Pool) {}

  /**
   * Upsert an entry and store raw JSON in entries_raw.
   * ON CONFLICT handles idempotent re-imports.
   */
  async upsert(entry: NewEntry, client?: PoolClient): Promise<number> {
    const conn = client ?? this.pool;
    const stableId = generateEntryId(entry.lemmaNormalized, entry.langCode, entry.sourceEdition);

    const { rows } = await conn.query<{ id: number }>(
      `INSERT INTO entries
         (lemma, lemma_normalized, lang_code, lang_name, pos, etymology_index, source_edition, source_word, forms, stable_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (lemma_normalized, lang_code, pos, etymology_index, source_edition)
       DO UPDATE SET
         lemma = EXCLUDED.lemma,
         lang_name = EXCLUDED.lang_name,
         source_word = EXCLUDED.source_word,
         forms = EXCLUDED.forms,
         stable_id = EXCLUDED.stable_id,
         updated_at = NOW()
       RETURNING id`,
      [
        entry.lemma,
        entry.lemmaNormalized,
        entry.langCode,
        entry.langName,
        entry.pos,
        entry.etymologyIndex,
        entry.sourceEdition,
        entry.sourceWord,
        entry.forms ? JSON.stringify(entry.forms) : null,
        stableId,
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
    edition?: string,
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
    if (edition) {
      params.push(edition);
      filters.push(`e.source_edition = $${params.length}`);
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
    edition?: string,
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
    if (edition) {
      params.push(edition);
      filters.push(`e.source_edition = $${params.length}`);
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

  async findByStableId(stableId: string): Promise<Entry[]> {
    const { rows } = await this.pool.query(
      `SELECT ${ENTRY_COLUMNS} FROM entries e WHERE e.stable_id = $1
       ORDER BY e.etymology_index, e.pos`,
      [stableId],
    );
    return rows.map(rowToEntry);
  }

  async findParentEntries(
    formNormalized: string,
    langCode: string,
    edition: string,
  ): Promise<Array<Entry & { formTags: string[] }>> {
    const { rows } = await this.pool.query(
      `SELECT ${ENTRY_COLUMNS}, ef.tags AS form_tags
       FROM entries e
       JOIN entry_forms ef ON ef.entry_id = e.id
       WHERE ef.form_normalized = $1
         AND e.lang_code = $2
         AND e.source_edition = $3
       ORDER BY e.lemma_normalized, e.pos, e.etymology_index`,
      [formNormalized, langCode, edition],
    );
    return rows.map((row) => ({
      ...rowToEntry(row),
      formTags: (row.form_tags as string[]) ?? [],
    }));
  }

  async browse(
    langCode: string,
    edition: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Entry[]> {
    const { rows } = await this.pool.query(
      `SELECT ${ENTRY_COLUMNS}
       FROM entries e
       WHERE e.lang_code = $1 AND e.source_edition = $2
       ORDER BY e.lemma_normalized, e.pos, e.etymology_index
       LIMIT $3 OFFSET $4`,
      [langCode, edition, limit, offset],
    );
    return rows.map(rowToEntry);
  }

  async listEditions(): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT source_edition FROM entries ORDER BY source_edition`,
    );
    return rows.map((r) => r.source_edition);
  }

  async listLanguages(edition: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT lang_code FROM entries WHERE source_edition = $1 ORDER BY lang_code`,
      [edition],
    );
    return rows.map((r) => r.lang_code);
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
    stableId: row.stable_id as string,
    lemma: row.lemma as string,
    lemmaNormalized: row.lemma_normalized as string,
    langCode: row.lang_code as string,
    langName: row.lang_name as string | null,
    pos: row.pos as string,
    etymologyIndex: row.etymology_index as number,
    sourceEdition: row.source_edition as string,
    sourceWord: row.source_word as string | null,
    forms: row.forms as Entry['forms'],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
