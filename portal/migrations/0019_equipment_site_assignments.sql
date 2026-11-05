-- Track the current site for each machine while retaining released assignment
-- history. A site may have any number of machines; a machine has one current
-- site at a time.
CREATE TABLE asset_site_assignments (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
  assigned_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  CHECK ((job_id IS NOT NULL AND home_id IS NULL) OR (job_id IS NULL AND home_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_asset_site_one_current_location
  ON asset_site_assignments(asset_id) WHERE released_at IS NULL;
CREATE INDEX idx_asset_site_job_current
  ON asset_site_assignments(job_id, asset_id) WHERE released_at IS NULL;
CREATE INDEX idx_asset_site_home_current
  ON asset_site_assignments(home_id, asset_id) WHERE released_at IS NULL;
