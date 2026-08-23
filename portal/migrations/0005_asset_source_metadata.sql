-- Preserve source-list verification notes independently of the operational
-- asset status.  A missing serial, disputed model, or ownership question must
-- never be "fixed" by guessing while importing the fleet register.

CREATE TABLE asset_source_metadata (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  source_notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('verified', 'needs_serial', 'needs_model', 'needs_owner', 'needs_vin', 'unassigned')),
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_asset_source_metadata_status
  ON asset_source_metadata(verification_status);
