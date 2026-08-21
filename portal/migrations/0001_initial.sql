PRAGMA foreign_keys = ON;

-- Employee identities are created only after their Cloudflare Access identity is
-- verified. Roles are enforced in the data-access layer, never by UI alone.
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  access_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'supervisor', 'billing', 'admin')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'complete', 'archived')),
  street_address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  google_maps_url TEXT,
  monday_item_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A manufactured home remains traceable throughout delivery, setup, inspection,
-- repair, and billing through its serial number.
CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  serial_number TEXT NOT NULL UNIQUE,
  manufacturer TEXT,
  model TEXT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  monday_item_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'delivery_pending' CHECK (status IN ('delivery_pending', 'installed', 'inspection_pending', 'complete', 'service')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('excavator', 'skid_steer', 'bulldozer', 'trailer', 'dump_truck', 'pickup_truck', 'other')),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  vin TEXT UNIQUE,
  plate_number TEXT,
  hour_meter REAL,
  odometer INTEGER,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'out_of_service', 'retired')),
  monday_item_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE work_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'complete', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TEXT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  assigned_to TEXT REFERENCES employees(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES employees(id),
  monday_item_id TEXT UNIQUE,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  inspection_kind TEXT NOT NULL CHECK (inspection_kind IN ('daily_equipment', 'delivery', 'setup', 'final_inspection')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'passed', 'defect_found', 'needs_review')),
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
  home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  performed_by TEXT NOT NULL REFERENCES employees(id),
  performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meter_reading REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((asset_id IS NOT NULL AND home_id IS NULL) OR (asset_id IS NULL AND home_id IS NOT NULL))
);

CREATE TABLE inspection_answers (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  checklist_key TEXT NOT NULL,
  question TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'not_applicable')),
  notes TEXT,
  UNIQUE (inspection_id, checklist_key)
);

CREATE TABLE repair_tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'approved', 'in_progress', 'awaiting_parts', 'complete', 'billed', 'closed')),
  bill_back_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (bill_back_status IN ('not_applicable', 'review_needed', 'ready_to_bill', 'billed', 'denied')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  reported_by TEXT NOT NULL REFERENCES employees(id),
  assigned_to TEXT REFERENCES employees(id) ON DELETE SET NULL,
  responsible_party TEXT,
  labor_minutes INTEGER,
  billing_notes TEXT,
  completed_at TEXT,
  billed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (home_id IS NOT NULL OR asset_id IS NOT NULL)
);

CREATE TABLE parts (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'each',
  quantity_on_hand REAL NOT NULL DEFAULT 0,
  reorder_point REAL NOT NULL DEFAULT 0,
  preferred_vendor TEXT,
  product_url TEXT,
  preferred_unit_cost_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE part_compatibility (
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
  manufacturer TEXT,
  model TEXT,
  PRIMARY KEY (part_id, asset_id, manufacturer, model)
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES parts(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('received', 'used', 'adjustment', 'returned')),
  quantity REAL NOT NULL CHECK (quantity <> 0),
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  recorded_by TEXT NOT NULL REFERENCES employees(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE material_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'ordered', 'received', 'cancelled')),
  part_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  requested_by TEXT NOT NULL REFERENCES employees(id),
  requested_quantity REAL NOT NULL CHECK (requested_quantity > 0),
  description TEXT NOT NULL,
  supplier_name TEXT,
  supplier_url TEXT,
  ordered_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  ordered_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Portal metadata points to private R2 objects for field photos and to Drive
-- files for plats, permits, and manufacturer documents. The database never
-- stores document contents or permanent public URLs.
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('plat', 'permit', 'photo', 'report', 'receipt', 'other')),
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2', 'google_drive')),
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  byte_size INTEGER,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (job_id IS NOT NULL OR home_id IS NOT NULL OR asset_id IS NOT NULL OR inspection_id IS NOT NULL OR repair_ticket_id IS NOT NULL)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('repair_reported', 'inventory_low', 'task_assigned', 'inspection_failed', 'daily_digest')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT,
  related_id TEXT,
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_assignee_status ON work_tasks(assigned_to, status, due_at);
CREATE INDEX idx_inspections_asset_day ON inspections(asset_id, performed_at);
CREATE INDEX idx_repairs_billing ON repair_tickets(bill_back_status, status, created_at);
CREATE INDEX idx_material_requests_status ON material_requests(status, created_at);
CREATE INDEX idx_documents_home ON documents(home_id, created_at);
