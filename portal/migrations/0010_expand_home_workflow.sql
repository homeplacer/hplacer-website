ALTER TABLE home_workflow_items RENAME TO home_workflow_items_v1;

CREATE TABLE home_workflow_items (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  value_date TEXT,
  value_boolean INTEGER CHECK (value_boolean IS NULL OR value_boolean IN (0, 1)),
  value_text TEXT,
  updated_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (home_id, item_key),
  CHECK (item_key IN (
    'delivery_date', 'delivered', 'scheduled_install_date', 'install_complete',
    'house_numbers_installed', 'permit_received', 'meter_set', 'inspection_scheduled',
    'inspection_date', 'final_inspection_passed', 'electric_ordered', 'utility_type',
    'foundation_certificate_received', 'home_inspection', 'skirting_framing_complete',
    'skirting_on', 'trim_out_complete', 'hvac_scheduled', 'hvac_installed',
    'sod_rock_installed', 'driveway_installed', 'mailbox_set'
  )),
  CHECK (value_date IS NULL OR value_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (value_text IS NULL OR (item_key = 'utility_type' AND value_text IN ('septic', 'sewer'))),
  CHECK ((value_date IS NOT NULL) + (value_boolean IS NOT NULL) + (value_text IS NOT NULL) <= 1)
);

INSERT INTO home_workflow_items
  (id, home_id, item_key, value_date, updated_by, created_at, updated_at)
SELECT id, home_id, item_key, value_date, updated_by, created_at, updated_at
  FROM home_workflow_items_v1;
DROP TABLE home_workflow_items_v1;
CREATE INDEX idx_home_workflow_home ON home_workflow_items(home_id, item_key);

CREATE TABLE home_workflow_history (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL REFERENCES employees(id),
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_home_workflow_history ON home_workflow_history(home_id, item_key, changed_at DESC);

INSERT INTO home_workflow_history (id, home_id, item_key, old_value, new_value, changed_by, changed_at)
SELECT 'hwh_' || id, home_id, item_key, NULL, value_date, updated_by, updated_at
  FROM home_workflow_items WHERE value_date IS NOT NULL;
