-- Read-only snapshots from the Monday Homes Roster. monday_item_id remains
-- the stable source identity; user-entered workflow, repair, and document data
-- stay in their existing columns and are never overwritten by this importer.
ALTER TABLE homes ADD COLUMN monday_item_name TEXT;
ALTER TABLE homes ADD COLUMN monday_stage TEXT;
ALTER TABLE homes ADD COLUMN monday_source_group TEXT;
ALTER TABLE homes ADD COLUMN monday_source_json TEXT;
ALTER TABLE homes ADD COLUMN monday_source_updated_at TEXT;
ALTER TABLE homes ADD COLUMN monday_source_synced_at TEXT;
ALTER TABLE homes ADD COLUMN monday_source_missing INTEGER NOT NULL DEFAULT 0
  CHECK (monday_source_missing IN (0, 1));

CREATE INDEX idx_homes_monday_source ON homes(monday_item_id) WHERE monday_item_id IS NOT NULL;
