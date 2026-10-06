-- GPS observations remain separate from assigned job location and equipment health.
CREATE TABLE gps_devices (
  device_id TEXT PRIMARY KEY,
  asset_id TEXT UNIQUE REFERENCES assets(id),
  latitude REAL,
  longitude REAL,
  reported_at TEXT,
  speed_kmh REAL,
  voltage REAL,
  fetched_at TEXT NOT NULL
);
CREATE TABLE gps_sync_state (
  id TEXT PRIMARY KEY CHECK (id = 'landairsea'),
  last_success_at TEXT NOT NULL,
  device_count INTEGER NOT NULL
);
