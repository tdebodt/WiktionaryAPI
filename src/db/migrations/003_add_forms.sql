-- Migration 003: Surface word forms (plural, diminutive, conjugations) from raw entry JSON

ALTER TABLE entries ADD COLUMN forms JSONB;

-- Backfill from raw_entry_json
UPDATE entries SET forms = raw_entry_json->'forms'
WHERE raw_entry_json ? 'forms'
  AND jsonb_array_length(raw_entry_json->'forms') > 0;
