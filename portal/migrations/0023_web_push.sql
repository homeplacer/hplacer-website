-- Web Push (installed Home Screen app) delivery for task-assignment alerts.
--
-- A browser push endpoint is bound to exactly one employee: the unique
-- endpoint hash means a shared device that switches accounts moves the
-- endpoint rather than alerting two people. Endpoints and keys are delivery
-- capabilities and are never returned by any portal route.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL UNIQUE,
  push_host TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_success_at TEXT,
  last_failure_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_test_at TEXT
);

CREATE INDEX idx_push_subscriptions_employee ON push_subscriptions(employee_id);

-- Durable per-subscription outbox. Rows are created in the same batch as the
-- in-portal notification and only for subscriptions that exist at that moment,
-- so enabling push or adding a device never replays older alerts.
CREATE TABLE push_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'gone', 'skipped', 'expired', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  -- Fencing token from the current claim; an outcome is only recorded by the
  -- sender that still holds it, so a reclaimed lease cannot be overwritten.
  claim_token TEXT,
  last_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  UNIQUE (notification_id, subscription_id)
);

CREATE INDEX idx_push_deliveries_due ON push_deliveries(status, next_attempt_at);
CREATE INDEX idx_push_deliveries_subscription ON push_deliveries(subscription_id, status);
