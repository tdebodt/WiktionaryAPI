-- Migration 005: Move raw JSON to separate tables for leaner main tables
-- Main tables stay fast and cacheable; raw JSON is joinable when needed.

CREATE TABLE entries_raw (
  entry_id BIGINT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  raw_json JSONB NOT NULL
);

CREATE TABLE senses_raw (
  sense_id BIGINT PRIMARY KEY REFERENCES senses(id) ON DELETE CASCADE,
  raw_json JSONB NOT NULL
);

-- Backfill from existing columns
INSERT INTO entries_raw (entry_id, raw_json)
SELECT id, raw_entry_json FROM entries WHERE raw_entry_json IS NOT NULL;

INSERT INTO senses_raw (sense_id, raw_json)
SELECT id, raw_sense_json FROM senses WHERE raw_sense_json IS NOT NULL;

-- Drop the old columns
ALTER TABLE entries DROP COLUMN raw_entry_json;
ALTER TABLE senses DROP COLUMN raw_sense_json;
