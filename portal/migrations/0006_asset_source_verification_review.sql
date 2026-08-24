-- A source flag is historical evidence, not an operational defect. Keep the
-- original import note intact while recording who reviewed and cleared it.

ALTER TABLE asset_source_metadata ADD COLUMN resolution_notes TEXT;
ALTER TABLE asset_source_metadata ADD COLUMN resolved_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE asset_source_metadata ADD COLUMN resolved_at TEXT;

CREATE INDEX idx_asset_source_metadata_open
  ON asset_source_metadata(verification_status, asset_id);
