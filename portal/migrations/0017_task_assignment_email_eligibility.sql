-- Only explicitly opted-in notification events can leave the portal by email.
-- Existing rows remain in-app only and will never be sent retroactively.
ALTER TABLE notifications
  ADD COLUMN email_eligible INTEGER NOT NULL DEFAULT 0 CHECK (email_eligible IN (0, 1));

CREATE INDEX idx_notifications_email_outbox
  ON notifications(email_eligible, delivered_at, created_at);
