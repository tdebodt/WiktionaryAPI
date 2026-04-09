-- Migration 006: Add source_edition to track which Wiktionary edition an entry came from.
-- e.g. 'fr' = French Wiktionary, 'nl' = Dutch Wiktionary, 'en' = English Wiktionary.
-- This prevents different editions from overwriting each other, since each edition
-- provides different glosses (in its own language) for the same word.

ALTER TABLE entries ADD COLUMN source_edition TEXT NOT NULL DEFAULT '';

-- Drop old unique constraint and create new one that includes source_edition
ALTER TABLE entries DROP CONSTRAINT entries_lemma_normalized_lang_code_pos_etymology_index_key;
ALTER TABLE entries ADD CONSTRAINT entries_lemma_norm_lang_pos_etym_edition_key
  UNIQUE (lemma_normalized, lang_code, pos, etymology_index, source_edition);

-- Index for filtering by source edition
CREATE INDEX idx_entries_source_edition ON entries (source_edition);
