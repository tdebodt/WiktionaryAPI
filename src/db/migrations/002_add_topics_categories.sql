-- Migration 002: Surface topics and categories from raw sense JSON

ALTER TABLE senses ADD COLUMN topics text[];
ALTER TABLE senses ADD COLUMN categories text[];

-- GIN indexes for array containment queries (e.g. WHERE topics @> '{architecture}')
CREATE INDEX idx_senses_topics ON senses USING gin (topics) WHERE topics IS NOT NULL;
CREATE INDEX idx_senses_categories ON senses USING gin (categories) WHERE categories IS NOT NULL;

-- Backfill from raw_sense_json
UPDATE senses SET
  topics = (
    SELECT array_agg(elem::text)
    FROM jsonb_array_elements_text(raw_sense_json->'topics') AS elem
  ),
  categories = (
    SELECT array_agg(elem::text)
    FROM jsonb_array_elements_text(raw_sense_json->'categories') AS elem
  )
WHERE raw_sense_json IS NOT NULL
  AND (raw_sense_json ? 'topics' OR raw_sense_json ? 'categories');
