-- Migration 001: Initial schema for Wiktionary dictionary data

CREATE TABLE entries (
  id              BIGSERIAL PRIMARY KEY,
  lemma           TEXT NOT NULL,
  lemma_normalized TEXT NOT NULL,
  lang_code       TEXT NOT NULL,
  lang_name       TEXT,
  pos             TEXT NOT NULL DEFAULT '',
  etymology_index SMALLINT NOT NULL DEFAULT 0,
  source_word     TEXT,
  raw_entry_json  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lemma_normalized, lang_code, pos, etymology_index)
);

CREATE TABLE senses (
  id              BIGSERIAL PRIMARY KEY,
  entry_id        BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  sense_index     INTEGER NOT NULL,
  gloss           TEXT NOT NULL,
  tags            TEXT[],
  examples_text   TEXT[],
  raw_sense_json  JSONB,

  UNIQUE (entry_id, sense_index)
);

-- Prefix search on normalized lemma (supports LIKE 'x%' queries)
CREATE INDEX idx_entries_lemma_prefix
  ON entries (lemma_normalized text_pattern_ops);

-- Lookup by normalized lemma + language
CREATE INDEX idx_entries_lemma_lang
  ON entries (lemma_normalized, lang_code);

-- Filter by language + part of speech
CREATE INDEX idx_entries_lang_pos
  ON entries (lang_code, pos);

-- Sense lookup by parent entry
CREATE INDEX idx_senses_entry_id
  ON senses (entry_id);

-- Full-text search on gloss definitions
CREATE INDEX idx_senses_gloss_fts
  ON senses USING gin (to_tsvector('french', gloss));
