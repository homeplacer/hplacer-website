-- A shared machine can be used by different employees and at different jobs.
-- Keep one simple record per use, keyed by the internal fleet asset id.
CREATE TABLE asset_usage_records (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hour_meter REAL CHECK (hour_meter IS NULL OR hour_meter >= 0),
  odometer INTEGER CHECK (odometer IS NULL OR odometer >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (hour_meter IS NULL OR odometer IS NULL)
);

CREATE INDEX idx_asset_usage_asset_date ON asset_usage_records(asset_id, used_at DESC);
CREATE INDEX idx_asset_usage_job_date ON asset_usage_records(job_id, used_at DESC);
