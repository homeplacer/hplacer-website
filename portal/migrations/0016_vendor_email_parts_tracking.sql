-- Read-only Gmail ingestion for vendor order, receipt, and shipping messages.
-- Message bodies are transient parser input only; D1 keeps only useful headers
-- and extracted fields. Attachments are staged in the existing private R2 bucket.

ALTER TABLE material_requests ADD COLUMN vendor_order_number TEXT;
ALTER TABLE material_requests ADD COLUMN carrier_name TEXT;
ALTER TABLE material_requests ADD COLUMN tracking_number TEXT;
ALTER TABLE material_requests ADD COLUMN tracking_url TEXT;
ALTER TABLE material_requests ADD COLUMN expected_arrival TEXT;
ALTER TABLE material_requests ADD COLUMN shipping_updated_at TEXT;

INSERT INTO notification_categories (category, label, description, default_role)
VALUES ('parts_tracking', 'Parts tracking', 'A vendor email was linked to a material request', 'billing');

CREATE INDEX idx_material_requests_vendor_order ON material_requests(vendor_order_number);
CREATE INDEX idx_material_requests_tracking ON material_requests(tracking_number);

CREATE TABLE vendor_email_events (
  id TEXT PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_date TEXT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('order', 'receipt', 'shipment', 'unknown')),
  vendor_order_number TEXT,
  carrier_name TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'needs_review', 'linked', 'ignored', 'failed')),
  candidate_material_request_id TEXT REFERENCES material_requests(id) ON DELETE SET NULL,
  match_reason TEXT,
  reviewed_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_email_review ON vendor_email_events(status, message_date DESC);
CREATE INDEX idx_vendor_email_order ON vendor_email_events(vendor_order_number);

CREATE TABLE vendor_email_attachments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES vendor_email_events(id) ON DELETE CASCADE,
  gmail_attachment_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 TEXT NOT NULL,
  document_id TEXT UNIQUE REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, gmail_attachment_id)
);

CREATE TABLE portal_integration_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
