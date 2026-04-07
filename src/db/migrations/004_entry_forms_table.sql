-- Migration 004: Lookup table for inflected forms → parent entries
-- Enables searching "huisje" and finding "huis"

CREATE TABLE entry_forms (
  entry_id        BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  form            TEXT NOT NULL,
  form_normalized TEXT NOT NULL,
  tags            TEXT[]
);

CREATE INDEX idx_entry_forms_normalized ON entry_forms(form_normalized);
CREATE INDEX idx_entry_forms_prefix ON entry_forms(form_normalized text_pattern_ops);
CREATE INDEX idx_entry_forms_entry_id ON entry_forms(entry_id);

-- Backfill from entries.forms JSONB
INSERT INTO entry_forms (entry_id, form, form_normalized, tags)
SELECT
  e.id,
  f->>'form',
  lower(trim(f->>'form')),
  ARRAY(SELECT jsonb_array_elements_text(f->'tags'))
FROM entries e, jsonb_array_elements(e.forms) AS f
WHERE e.forms IS NOT NULL;
