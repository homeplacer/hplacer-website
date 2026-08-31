-- 0004_warranty_and_routing.sql
--
-- Adds the public warranty-request intake, the matching keys it needs, an
-- optional editable site address on each home, configurable notification
-- recipients, and the bookkeeping for Monday.com read-only discovery runs.
--
-- Two tables from earlier migrations are recreated: `documents` gains a
-- warranty-request target that its CHECK has to cover, and `notifications`
-- swaps its hard-coded category CHECK for a foreign key into a reference
-- table, so a new category is an INSERT from now on instead of another table
-- rebuild. No database has been provisioned yet (see portal/README.md), so
-- both tables are empty.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------------
-- Homes: optional site address and the owner of record
--
-- A home is filed under its serial number, but a homeowner calling about a
-- warranty knows their address and their phone number, not a data plate. These
-- columns are optional and edited from the home's page in the field.
--
-- The *_key columns hold normalized forms (see src/domain/matching.ts) and are
-- the only thing warranty matching compares against. They are written by the
-- application, never typed by hand.
------------------------------------------------------------------------------

ALTER TABLE homes ADD COLUMN site_address TEXT;
ALTER TABLE homes ADD COLUMN site_city TEXT;
ALTER TABLE homes ADD COLUMN site_state TEXT;
ALTER TABLE homes ADD COLUMN site_postal_code TEXT;
ALTER TABLE homes ADD COLUMN site_address_key TEXT;
ALTER TABLE homes ADD COLUMN site_address_notes TEXT;

ALTER TABLE homes ADD COLUMN customer_name TEXT;
ALTER TABLE homes ADD COLUMN customer_name_key TEXT;
ALTER TABLE homes ADD COLUMN customer_phone TEXT;
ALTER TABLE homes ADD COLUMN customer_phone_key TEXT;
ALTER TABLE homes ADD COLUMN customer_email TEXT;

CREATE INDEX idx_homes_site_address_key ON homes(site_address_key) WHERE site_address_key IS NOT NULL;
CREATE INDEX idx_homes_customer_phone_key ON homes(customer_phone_key) WHERE customer_phone_key IS NOT NULL;
CREATE INDEX idx_homes_customer_name_key ON homes(customer_name_key) WHERE customer_name_key IS NOT NULL;

-- Lots and subdivisions carry the same normalized key so a homeowner's address
-- still matches when the home record itself has no site address filled in.
ALTER TABLE lots ADD COLUMN address_key TEXT;
ALTER TABLE jobs ADD COLUMN address_key TEXT;

CREATE INDEX idx_lots_address_key ON lots(address_key) WHERE address_key IS NOT NULL;
CREATE INDEX idx_jobs_address_key ON jobs(address_key) WHERE address_key IS NOT NULL;

------------------------------------------------------------------------------
-- Warranty requests from the public site
--
-- Intake never guesses. A request is attached to a home only when one home
-- matches confidently; otherwise it lands in the review queue unlinked, with
-- the candidates it considered recorded so a person can finish the job.
------------------------------------------------------------------------------

CREATE TABLE warranty_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'linked', 'ticketed', 'duplicate', 'dismissed')),

  -- What the homeowner told us
  customer_name TEXT NOT NULL,
  customer_name_key TEXT,
  customer_phone TEXT,
  customer_phone_key TEXT,
  customer_email TEXT,
  preferred_contact TEXT CHECK (preferred_contact IS NULL OR preferred_contact IN ('phone', 'email', 'text')),
  best_time TEXT,

  reported_serial TEXT,
  reported_address TEXT,
  reported_city TEXT,
  reported_state TEXT,
  reported_postal_code TEXT,
  reported_address_key TEXT,

  issue_summary TEXT NOT NULL,
  issue_detail TEXT,

  -- What matching concluded
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  match_method TEXT NOT NULL DEFAULT 'none'
    CHECK (match_method IN ('none', 'serial', 'address', 'phone', 'name_and_address', 'name_and_phone', 'manual')),
  match_confidence TEXT NOT NULL DEFAULT 'none'
    CHECK (match_confidence IN ('none', 'ambiguous', 'confident')),
  match_reason TEXT,
  -- JSON array of the homes considered, so a reviewer sees what intake saw.
  match_candidates TEXT,

  repair_ticket_id TEXT REFERENCES repair_tickets(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_notes TEXT,

  source TEXT NOT NULL DEFAULT 'public_site' CHECK (source IN ('public_site', 'phone', 'portal')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- A confident match is the only way a request may carry a home.
  CHECK ((home_id IS NULL AND match_confidence <> 'confident')
      OR (home_id IS NOT NULL AND match_confidence = 'confident')),
  CHECK (repair_ticket_id IS NULL OR home_id IS NOT NULL)
);

-- The service identity a warranty ticket is filed under. repair_tickets.reported_by
-- is NOT NULL, and a homeowner is not an employee, so intake needs a row of its
-- own. It is inactive and its address is on the reserved .invalid TLD, so it can
-- never sign in and can never receive mail.
INSERT INTO employees (id, access_subject, email, display_name, role, active, created_at, updated_at)
VALUES ('emp_system_intake', 'system:warranty-intake', 'warranty-intake@system.invalid',
        'Warranty intake (system)', 'employee', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE INDEX idx_warranty_review_queue ON warranty_requests(status, created_at);
CREATE INDEX idx_warranty_home ON warranty_requests(home_id, created_at);
CREATE INDEX idx_warranty_phone_key ON warranty_requests(customer_phone_key) WHERE customer_phone_key IS NOT NULL;

------------------------------------------------------------------------------
-- Notification categories and routing
--
-- Recipients are configuration, not code. Each category has a default role so
-- the portal still notifies somebody before anyone touches the routing table.
------------------------------------------------------------------------------

CREATE TABLE notification_categories (
  category TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  default_role TEXT NOT NULL CHECK (default_role IN ('employee', 'supervisor', 'billing', 'admin')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

INSERT INTO notification_categories (category, label, description, default_role) VALUES
  ('repair_reported',   'Repair reported',      'A crew member opened a repair ticket',                 'supervisor'),
  ('inventory_low',     'Low stock',            'A part crossed its reorder point',                     'billing'),
  ('task_assigned',     'Task assigned',        'Work was assigned, reassigned, or closed',             'employee'),
  ('inspection_failed', 'Inspection failed',    'A pre-use inspection or home report found defects',    'supervisor'),
  ('defect_reported',   'Defect reported',      'A defect was reported from the field',                 'supervisor'),
  ('material_requested','Material requested',   'Somebody asked the office to buy something',           'billing'),
  ('service_due',       'Service due',          'Equipment is coming due or overdue for service',       'supervisor'),
  ('billing_ready',     'Billing',              'A ticket is ready for bill-back review or was billed', 'billing'),
  ('daily_digest',      'Daily digest',         'Morning summary',                                      'supervisor'),
  ('warranty_request',  'Warranty request',     'A homeowner submitted a warranty request',             'supervisor');

CREATE TABLE notification_routes (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL REFERENCES notification_categories(category) ON DELETE CASCADE,
  -- 'role' fans out to everyone holding it; 'employee' targets one person.
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('role', 'employee')),
  recipient_role TEXT CHECK (recipient_role IS NULL OR recipient_role IN ('employee', 'supervisor', 'billing', 'admin')),
  recipient_employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((recipient_kind = 'role' AND recipient_role IS NOT NULL AND recipient_employee_id IS NULL)
      OR (recipient_kind = 'employee' AND recipient_employee_id IS NOT NULL AND recipient_role IS NULL))
);

CREATE UNIQUE INDEX idx_notification_routes_role
  ON notification_routes(category, recipient_role) WHERE recipient_kind = 'role';
CREATE UNIQUE INDEX idx_notification_routes_employee
  ON notification_routes(category, recipient_employee_id) WHERE recipient_kind = 'employee';

------------------------------------------------------------------------------
-- notifications: category CHECK becomes a foreign key
------------------------------------------------------------------------------

DROP INDEX idx_notifications_inbox;
DROP INDEX idx_notifications_dedupe;
DROP TABLE notifications;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES notification_categories(category),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT,
  related_id TEXT,
  dedupe_key TEXT,
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_inbox ON notifications(employee_id, read_at, created_at);
CREATE UNIQUE INDEX idx_notifications_dedupe ON notifications(employee_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

------------------------------------------------------------------------------
-- documents: add the warranty-request target
------------------------------------------------------------------------------

DROP INDEX idx_documents_home;
DROP INDEX idx_documents_asset;
DROP INDEX idx_documents_ticket;
DROP INDEX idx_documents_inspection;
DROP INDEX idx_documents_task;
DROP INDEX idx_documents_pending;
DROP TABLE documents;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('plat', 'permit', 'photo', 'report', 'receipt', 'invoice', 'other')),
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2', 'google_drive')),
  storage_key TEXT NOT NULL,
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
  warranty_request_id TEXT REFERENCES warranty_requests(id) ON DELETE SET NULL,
  -- A homeowner's photo has no employee behind it; NULL means "submitted by the
  -- public warranty form", which only ever happens alongside a warranty_request_id.
  uploaded_by TEXT REFERENCES employees(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (coalesce(job_id, lot_id, home_id, asset_id, inspection_id, repair_ticket_id,
                  work_task_id, material_request_id, defect_id, warranty_request_id) IS NOT NULL),
  CHECK (uploaded_by IS NOT NULL OR warranty_request_id IS NOT NULL),
  CHECK (storage_provider <> 'google_drive' OR external_url IS NOT NULL),
  CHECK (storage_provider <> 'r2' OR external_url IS NULL)
);

CREATE INDEX idx_documents_home ON documents(home_id, created_at);
CREATE INDEX idx_documents_asset ON documents(asset_id, created_at);
CREATE INDEX idx_documents_ticket ON documents(repair_ticket_id, created_at);
CREATE INDEX idx_documents_inspection ON documents(inspection_id, created_at);
CREATE INDEX idx_documents_task ON documents(work_task_id, created_at);
CREATE INDEX idx_documents_warranty ON documents(warranty_request_id, created_at);
CREATE INDEX idx_documents_pending ON documents(upload_status, created_at);

------------------------------------------------------------------------------
-- Monday.com discovery runs
--
-- Read-only import bookkeeping. A discovery run reads a Monday board, maps each
-- item to a portal canonical key, and records what it found. It never writes to
-- Monday, and it only writes monday_links when an operator asks for it
-- explicitly (see portal/ops/monday-discover.ts).
------------------------------------------------------------------------------

CREATE TABLE monday_discovery_runs (
  id TEXT PRIMARY KEY,
  board_key TEXT NOT NULL REFERENCES monday_boards(board_key) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('discover', 'import_links')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  items_seen INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  ambiguous INTEGER NOT NULL DEFAULT 0,
  unmatched INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  links_written INTEGER NOT NULL DEFAULT 0,
  -- JSON report. Never contains credentials.
  report TEXT,
  run_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  error TEXT
);

CREATE INDEX idx_monday_runs ON monday_discovery_runs(board_key, started_at);
