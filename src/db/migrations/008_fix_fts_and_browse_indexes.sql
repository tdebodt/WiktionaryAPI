-- Migration 008: Fix hardcoded French FTS index + add composite browse index

-- Replace French-only FTS index with language-agnostic 'simple' configuration.
-- 'simple' tokenizes and lowercases without language-specific stemming,
-- which is correct for a multi-language corpus.
DROP INDEX IF EXISTS idx_senses_gloss_fts;
CREATE INDEX idx_senses_gloss_fts
  ON senses USING gin (to_tsvector('simple', gloss));

-- Composite index for EntryRepository.browse() queries that filter on
-- (lang_code, source_edition) and order by (lemma_normalized, pos, etymology_index).
-- Covers both the WHERE and ORDER BY in a single B-tree scan.
CREATE INDEX idx_entries_browse
  ON entries (lang_code, source_edition, lemma_normalized, pos, etymology_index);
