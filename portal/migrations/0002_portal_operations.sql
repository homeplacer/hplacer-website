-- 0002_portal_operations.sql
--
-- Builds the field-operations surface on top of 0001: lots and Drive
-- references, checklist-driven inspections and home reports, equipment defects
-- and service tracking, repair labor/material costing for the bill-back queue,
-- the Monday.com link registry, and the audit log.
--
-- Three tables from 0001 are recreated rather than altered. SQLite cannot add
-- or amend a table CHECK constraint with ALTER TABLE, and all three gained new
-- columns that the original CHECK has to cover. No database has been
-- provisioned yet (see portal/README.md), so the tables are empty and the
-- DROP/CREATE is safe.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------------
-- Employees: additional role grants
------------------------------------------------------------------------------

-- employees.role stays the primary role. Extra grants let one person hold more
-- than one hat (Tara runs the billing queue and is also a supervisor) without
-- handing anybody the admin role just to widen their access.
CREATE TABLE employee_role_grants (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('employee', 'supervisor', 'billing', 'admin')),
  granted_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, role)
);

ALTER TABLE employees ADD COLUMN phone TEXT;
ALTER TABLE employees ADD COLUMN crew TEXT;
ALTER TABLE employees ADD COLUMN last_seen_at TEXT;

------------------------------------------------------------------------------
-- Jobs and lots
------------------------------------------------------------------------------

ALTER TABLE jobs ADD COLUMN drive_folder_url TEXT;
ALTER TABLE jobs ADD COLUMN supervisor_id TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN customer_reference TEXT;
ALTER TABLE jobs ADD COLUMN notes TEXT;

-- A job may cover one address or a whole subdivision, so the placement detail
-- (map pin, plat, permit) lives on the lot rather than the job.
CREATE TABLE lots (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  parcel_id TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude REAL,
  longitude REAL,
  google_maps_url TEXT,
  plat_drive_url TEXT,
  permit_drive_url TEXT,
  access_notes TEXT,
  utility_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'permitted', 'prepped', 'set', 'complete')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_id, lot_number)
);

CREATE INDEX idx_lots_job ON lots(job_id, lot_number);

------------------------------------------------------------------------------
-- Homes
------------------------------------------------------------------------------

ALTER TABLE homes ADD COLUMN lot_id TEXT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE homes ADD COLUMN model_year INTEGER;
ALTER TABLE homes ADD COLUMN section_count INTEGER;
ALTER TABLE homes ADD COLUMN hud_label_numbers TEXT;
ALTER TABLE homes ADD COLUMN delivered_on TEXT;
ALTER TABLE homes ADD COLUMN setup_completed_on TEXT;
ALTER TABLE homes ADD COLUMN final_inspection_on TEXT;
ALTER TABLE homes ADD COLUMN warranty_expires_on TEXT;

CREATE INDEX idx_homes_job ON homes(job_id, status);

------------------------------------------------------------------------------
-- Checklist templates drive both equipment pre-use inspections and the
-- delivery / setup / final-inspection home reports.
------------------------------------------------------------------------------

CREATE TABLE checklist_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  inspection_kind TEXT NOT NULL CHECK (inspection_kind IN ('daily_equipment', 'delivery', 'setup', 'final_inspection')),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('asset', 'home')),
  asset_type TEXT CHECK (asset_type IS NULL OR asset_type IN ('excavator', 'skid_steer', 'bulldozer', 'trailer', 'dump_truck', 'pickup_truck', 'other')),
  meter_prompt TEXT CHECK (meter_prompt IS NULL OR meter_prompt IN ('hours', 'miles')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((applies_to = 'asset' AND inspection_kind = 'daily_equipment')
      OR (applies_to = 'home' AND inspection_kind <> 'daily_equipment'))
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  checklist_key TEXT NOT NULL,
  question TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  critical INTEGER NOT NULL DEFAULT 0 CHECK (critical IN (0, 1)),
  requires_note_on_fail INTEGER NOT NULL DEFAULT 1 CHECK (requires_note_on_fail IN (0, 1)),
  UNIQUE (template_id, checklist_key)
);

-- Free-form report data (transporter, blocking counts, permit number, ...) that
-- is captured alongside the pass/fail checklist on a home report.
CREATE TABLE inspection_fields (
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (inspection_id, field_key)
);

ALTER TABLE inspections ADD COLUMN template_id TEXT REFERENCES checklist_templates(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN lot_id TEXT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN odometer INTEGER;
ALTER TABLE inspections ADD COLUMN submitted_at TEXT;

-- One pre-use inspection per operator, per machine, per calendar day.
CREATE UNIQUE INDEX idx_daily_equipment_once_per_day
  ON inspections(asset_id, performed_by, substr(performed_at, 1, 10))
  WHERE inspection_kind = 'daily_equipment';

CREATE INDEX idx_inspections_home_kind ON inspections(home_id, inspection_kind, performed_at);

------------------------------------------------------------------------------
-- Defects raised by an inspection or reported from the field
------------------------------------------------------------------------------

CREATE TABLE defects (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  detail TEXT,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ticketed', 'resolved', 'dismissed')),
  source TEXT NOT NULL CHECK (source IN ('inspection', 'field_report')),
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  checklist_key TEXT,
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
  home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  reported_by TEXT NOT NULL REFERENCES employees(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (asset_id IS NOT NULL OR home_id IS NOT NULL)
);

CREATE INDEX idx_defects_open ON defects(status, severity, created_at);

------------------------------------------------------------------------------
-- Equipment service tracking
------------------------------------------------------------------------------

CREATE TABLE asset_service_schedules (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  description TEXT NOT NULL,
  interval_hours REAL CHECK (interval_hours IS NULL OR interval_hours > 0),
  interval_miles INTEGER CHECK (interval_miles IS NULL OR interval_miles > 0),
  interval_days INTEGER CHECK (interval_days IS NULL OR interval_days > 0),
  last_service_at TEXT,
  last_service_hours REAL,
  last_service_miles INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (asset_id, service_key),
  CHECK (interval_hours IS NOT NULL OR interval_miles IS NOT NULL OR interval_days IS NOT NULL)
);

CREATE TABLE asset_service_records (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES asset_service_schedules(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('preventive', 'repair', 'inspection', 'other')),
  description TEXT NOT NULL,
  performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  performed_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  vendor TEXT,
  hour_meter REAL,
  odometer INTEGER,
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_records_asset ON asset_service_records(asset_id, performed_at);

-- Every hour/odometer value ever entered, so a mistyped reading can be traced
-- rather than silently overwriting assets.hour_meter / assets.odometer.
CREATE TABLE asset_meter_readings (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reading_type TEXT NOT NULL CHECK (reading_type IN ('hours', 'miles')),
  value REAL NOT NULL CHECK (value >= 0),
  source TEXT NOT NULL CHECK (source IN ('inspection', 'service', 'manual')),
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  recorded_by TEXT NOT NULL REFERENCES employees(id),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meter_readings_asset ON asset_meter_readings(asset_id, recorded_at);

ALTER TABLE assets ADD COLUMN model_year INTEGER;
ALTER TABLE assets ADD COLUMN home_base TEXT;
ALTER TABLE assets ADD COLUMN assigned_to TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN out_of_service_reason TEXT;

------------------------------------------------------------------------------
-- Tasks
------------------------------------------------------------------------------

ALTER TABLE work_tasks ADD COLUMN lot_id TEXT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN completed_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN completion_notes TEXT;
-- Supervisors can demand a photo before the portal will accept a completion.
ALTER TABLE work_tasks ADD COLUMN requires_photo INTEGER NOT NULL DEFAULT 0 CHECK (requires_photo IN (0, 1));

------------------------------------------------------------------------------
-- Repair tickets: responsible party, labor, materials, billing queue
------------------------------------------------------------------------------

ALTER TABLE repair_tickets ADD COLUMN lot_id TEXT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE repair_tickets ADD COLUMN responsible_party_type TEXT
  CHECK (responsible_party_type IS NULL OR responsible_party_type IN
    ('manufacturer', 'transporter', 'setup_crew', 'operator', 'customer', 'vendor', 'internal', 'unknown'));
ALTER TABLE repair_tickets ADD COLUMN approved_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE repair_tickets ADD COLUMN approved_at TEXT;
ALTER TABLE repair_tickets ADD COLUMN billed_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE repair_tickets ADD COLUMN bill_back_amount_cents INTEGER CHECK (bill_back_amount_cents IS NULL OR bill_back_amount_cents >= 0);
ALTER TABLE repair_tickets ADD COLUMN invoice_reference TEXT;
ALTER TABLE repair_tickets ADD COLUMN source_defect_id TEXT REFERENCES defects(id) ON DELETE SET NULL;
-- 0001 gave jobs, homes, assets, and tasks a monday_item_id but not tickets;
-- the repairs board needs the same mirror column. ALTER TABLE cannot add a
-- UNIQUE column, so the constraint is a separate index.
ALTER TABLE repair_tickets ADD COLUMN monday_item_id TEXT;
CREATE UNIQUE INDEX idx_repair_tickets_monday ON repair_tickets(monday_item_id) WHERE monday_item_id IS NOT NULL;

CREATE TABLE repair_labor_entries (
  id TEXT PRIMARY KEY,
  repair_ticket_id TEXT NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  worked_on TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  rate_cents_per_hour INTEGER NOT NULL DEFAULT 0 CHECK (rate_cents_per_hour >= 0),
  description TEXT,
  recorded_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repair_labor_ticket ON repair_labor_entries(repair_ticket_id);

CREATE TABLE repair_material_lines (
  id TEXT PRIMARY KEY,
  repair_ticket_id TEXT NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  part_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  inventory_movement_id TEXT REFERENCES inventory_movements(id) ON DELETE SET NULL,
  recorded_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repair_materials_ticket ON repair_material_lines(repair_ticket_id);

-- Who moved a ticket, when, and why — the paper trail behind a bill-back.
CREATE TABLE repair_status_events (
  id TEXT PRIMARY KEY,
  repair_ticket_id TEXT NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  field TEXT NOT NULL CHECK (field IN ('status', 'bill_back_status', 'responsible_party')),
  from_value TEXT,
  to_value TEXT NOT NULL,
  note TEXT,
  changed_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repair_events_ticket ON repair_status_events(repair_ticket_id, created_at);

------------------------------------------------------------------------------
-- Inventory
------------------------------------------------------------------------------

ALTER TABLE parts ADD COLUMN reorder_quantity REAL NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0);
ALTER TABLE parts ADD COLUMN storage_location TEXT;
-- Set when a low-stock notification fires so the daily sweep does not re-alert
-- on the same shortage every run.
ALTER TABLE parts ADD COLUMN low_stock_notified_at TEXT;

ALTER TABLE material_requests ADD COLUMN needed_by TEXT;
ALTER TABLE material_requests ADD COLUMN approved_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE material_requests ADD COLUMN approved_at TEXT;
ALTER TABLE material_requests ADD COLUMN estimated_unit_cost_cents INTEGER CHECK (estimated_unit_cost_cents IS NULL OR estimated_unit_cost_cents >= 0);

CREATE INDEX idx_inventory_movements_part ON inventory_movements(part_id, created_at);

-- inventory_movements.quantity is signed: 'received'/'returned' are positive,
-- 'used' is negative, 'adjustment' may be either. The trigger is what keeps
-- parts.quantity_on_hand honest; nothing writes that column directly.
CREATE TRIGGER trg_inventory_movement_applies_to_stock
AFTER INSERT ON inventory_movements
BEGIN
  UPDATE parts
     SET quantity_on_hand = quantity_on_hand + NEW.quantity,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.part_id;
END;

------------------------------------------------------------------------------
-- Monday.com link registry
--
-- This portal never calls Monday. It records which canonical key (serial
-- number, VIN, asset tag, job or ticket number) maps to which Monday item id,
-- and queues the changes a future sync worker would push. Nothing else about a
-- Monday board is mirrored here.
------------------------------------------------------------------------------

CREATE TABLE monday_boards (
  board_key TEXT PRIMARY KEY CHECK (board_key IN ('homes', 'equipment', 'jobs', 'tasks', 'repairs')),
  monday_board_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  canonical_key_kind TEXT NOT NULL CHECK (canonical_key_kind IN ('serial_number', 'vin', 'asset_tag', 'job_number', 'ticket_number')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monday_links (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('home', 'asset', 'job', 'work_task', 'repair_ticket')),
  entity_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  board_key TEXT NOT NULL REFERENCES monday_boards(board_key) ON DELETE CASCADE,
  monday_item_id TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'linked', 'conflict', 'detached')),
  last_synced_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (entity_type, entity_id),
  UNIQUE (board_key, monday_item_id)
);

CREATE INDEX idx_monday_links_key ON monday_links(canonical_key);

CREATE TABLE monday_sync_queue (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES monday_links(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('link', 'push', 'detach')),
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE INDEX idx_monday_queue_status ON monday_sync_queue(status, created_at);

------------------------------------------------------------------------------
-- Documents (recreated: adds lot/task/material-request targets and the upload
-- lifecycle used by the future authenticated R2 upload API)
------------------------------------------------------------------------------

DROP INDEX idx_documents_home;
DROP TABLE documents;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('plat', 'permit', 'photo', 'report', 'receipt', 'invoice', 'other')),
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2', 'google_drive')),
  -- R2 object key, or the Google Drive file id. Never a public URL.
  storage_key TEXT NOT NULL,
  -- Drive webViewLink only. R2 objects are streamed through an authorized
  -- portal route, so they never get a stored URL.
  external_url TEXT,
  file_name TEXT NOT NULL,
  content_type TEXT,
  byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0),
  checksum_sha256 TEXT,
  upload_status TEXT NOT NULL DEFAULT 'stored' CHECK (upload_status IN ('pending', 'stored', 'failed', 'deleted')),
  caption TEXT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  lot_id TEXT REFERENCES lots(id) ON DELETE SET NULL,
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  work_task_id TEXT REFERENCES work_tasks(id) ON DELETE SET NULL,
  material_request_id TEXT REFERENCES material_requests(id) ON DELETE SET NULL,
  defect_id TEXT REFERENCES defects(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (coalesce(job_id, lot_id, home_id, asset_id, inspection_id, repair_ticket_id, work_task_id, material_request_id, defect_id) IS NOT NULL),
  CHECK (storage_provider <> 'google_drive' OR external_url IS NOT NULL),
  CHECK (storage_provider <> 'r2' OR external_url IS NULL)
);

CREATE INDEX idx_documents_home ON documents(home_id, created_at);
CREATE INDEX idx_documents_asset ON documents(asset_id, created_at);
CREATE INDEX idx_documents_ticket ON documents(repair_ticket_id, created_at);
CREATE INDEX idx_documents_inspection ON documents(inspection_id, created_at);
CREATE INDEX idx_documents_task ON documents(work_task_id, created_at);
CREATE INDEX idx_documents_pending ON documents(upload_status, created_at);

------------------------------------------------------------------------------
-- Notifications (recreated: the 0001 CHECK did not cover defects, material
-- requests, service-due, or the billing queue)
------------------------------------------------------------------------------

DROP TABLE notifications;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'repair_reported', 'inventory_low', 'task_assigned', 'inspection_failed',
    'defect_reported', 'material_requested', 'service_due', 'billing_ready', 'daily_digest')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT,
  related_id TEXT,
  -- Deduplicates repeat alerts for the same underlying condition.
  dedupe_key TEXT,
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_inbox ON notifications(employee_id, read_at, created_at);
CREATE UNIQUE INDEX idx_notifications_dedupe ON notifications(employee_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

------------------------------------------------------------------------------
-- part_compatibility (recreated: the 0001 primary key spanned nullable
-- columns, and SQLite does not enforce NOT NULL on those, so duplicate rows
-- were possible)
------------------------------------------------------------------------------

DROP TABLE part_compatibility;

CREATE TABLE part_compatibility (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
  asset_type TEXT CHECK (asset_type IS NULL OR asset_type IN ('excavator', 'skid_steer', 'bulldozer', 'trailer', 'dump_truck', 'pickup_truck', 'other')),
  manufacturer TEXT,
  model TEXT,
  CHECK (coalesce(asset_id, asset_type, manufacturer) IS NOT NULL)
);

CREATE UNIQUE INDEX idx_part_compatibility_unique ON part_compatibility(
  part_id, ifnull(asset_id, ''), ifnull(asset_type, ''), ifnull(manufacturer, ''), ifnull(model, '')
);

------------------------------------------------------------------------------
-- Audit log: every authorization decision that touches a record, allowed or
-- denied. The portal is the system of record for who looked at what.
------------------------------------------------------------------------------

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  detail TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_actor ON audit_log(actor_employee_id, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at);
