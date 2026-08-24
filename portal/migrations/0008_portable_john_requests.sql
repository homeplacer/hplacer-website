-- Employee requests for portable toilet delivery or pickup, routed to operations.

CREATE TABLE portable_john_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL CHECK (request_type IN ('delivery', 'pickup')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'scheduled', 'complete', 'cancelled')),
  requested_date TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 25),
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  home_id TEXT REFERENCES homes(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  location_details TEXT NOT NULL,
  notes TEXT,
  requested_by TEXT NOT NULL REFERENCES employees(id),
  operations_notes TEXT,
  completed_at TEXT,
  completed_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((job_id IS NOT NULL) + (home_id IS NOT NULL) + (asset_id IS NOT NULL) = 1)
);

CREATE INDEX idx_portable_john_queue ON portable_john_requests(status, requested_date, created_at);
CREATE INDEX idx_portable_john_requester ON portable_john_requests(requested_by, created_at);

INSERT INTO notification_categories (category, label, description, default_role) VALUES
  ('portable_john_request', 'Portable John request', 'Delivery or pickup requested by an employee', 'supervisor');
