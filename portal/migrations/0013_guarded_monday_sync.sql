-- Guarded outbound Monday synchronization and transport-neutral notification
-- delivery bookkeeping. Outbound sync remains disabled unless the Worker has
-- an explicit feature flag, token secret, and validated board/column map.

PRAGMA foreign_keys = OFF;

CREATE TABLE monday_sync_queue_guarded (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES monday_links(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('link', 'push', 'detach')),
  payload TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'sent', 'failed', 'conflict', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

INSERT INTO monday_sync_queue_guarded
  (id, link_id, entity_type, entity_id, canonical_key, operation, payload,
   idempotency_key, status, attempts, last_error, created_at, processed_at)
SELECT id, link_id, entity_type, entity_id, canonical_key, operation, payload,
       'legacy:' || id, status, attempts, last_error, created_at, processed_at
  FROM monday_sync_queue;

DROP INDEX idx_monday_queue_status;
DROP TABLE monday_sync_queue;
ALTER TABLE monday_sync_queue_guarded RENAME TO monday_sync_queue;

CREATE INDEX idx_monday_queue_ready
  ON monday_sync_queue(status, next_attempt_at, created_at);

ALTER TABLE notifications ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN next_delivery_at TEXT;
ALTER TABLE notifications ADD COLUMN last_delivery_error TEXT;

CREATE INDEX idx_notifications_delivery
  ON notifications(delivered_at, next_delivery_at, created_at);

PRAGMA foreign_keys = ON;
