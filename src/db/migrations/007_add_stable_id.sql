-- Migration 007: Add stable_id to entries for deterministic API lookups.
-- Computed from SHA-256 of (lemma_normalized, lang_code, source_edition).
-- Multiple rows (different pos/etymology) share the same stable_id.

ALTER TABLE entries ADD COLUMN stable_id TEXT;

CREATE INDEX idx_entries_stable_id ON entries (stable_id);
