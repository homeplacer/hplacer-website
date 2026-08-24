-- Extensible per-home workflow values. The first item is the planned delivery
-- date; actual delivery remains recorded by the existing delivery report.

CREATE TABLE home_workflow_items (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  value_date TEXT,
  updated_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (home_id, item_key),
  CHECK (item_key IN ('delivery_date')),
  CHECK (value_date IS NULL OR value_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX idx_home_workflow_home ON home_workflow_items(home_id, item_key);
