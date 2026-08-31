/** Provider-neutral outbox dispatcher for the in-portal notification table. */
import type { Db } from "../platform/types.ts";
import { redact } from "../integrations/monday-credentials.ts";

export interface NotificationDeliveryMessage {
  /** Stable provider idempotency key. */
  id: string;
  recipientEmail: string;
  title: string;
  body: string;
  severity: string;
}

export interface NotificationDispatcher {
  send(message: NotificationDeliveryMessage): Promise<void>;
}

export class NotificationDeliveryError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "NotificationDeliveryError";
    this.retryable = retryable;
  }
}

interface OutboxRow {
  id: string;
  recipient_email: string;
  title: string;
  body: string;
  severity: string;
  delivery_attempts: number;
}

export async function dispatchNotificationOutbox(
  db: Db,
  dispatcher: NotificationDispatcher,
  options: { limit?: number; now?: Date } = {},
): Promise<{ sent: number; retried: number; failed: number }> {
  const now = options.now ?? new Date();
  const rows = await db
    .prepare(
      `SELECT n.id, e.email AS recipient_email, n.title, n.body, n.severity, n.delivery_attempts
         FROM notifications n JOIN employees e ON e.id = n.employee_id AND e.active = 1
        WHERE n.delivered_at IS NULL AND (n.next_delivery_at IS NULL OR n.next_delivery_at <= ?)
        ORDER BY n.created_at, n.rowid LIMIT ?`,
    )
    .bind(now.toISOString(), Math.min(Math.max(options.limit ?? 25, 1), 100))
    .all<OutboxRow>();

  const summary = { sent: 0, retried: 0, failed: 0 };
  for (const row of rows.results) {
    const attempts = row.delivery_attempts + 1;
    await db.prepare("UPDATE notifications SET delivery_attempts = ? WHERE id = ? AND delivered_at IS NULL").bind(attempts, row.id).run();
    try {
      await dispatcher.send({
        id: row.id,
        recipientEmail: row.recipient_email,
        title: row.title,
        body: row.body,
        severity: row.severity,
      });
      await db
        .prepare("UPDATE notifications SET delivered_at = ?, next_delivery_at = NULL, last_delivery_error = NULL WHERE id = ?")
        .bind(now.toISOString(), row.id)
        .run();
      summary.sent += 1;
    } catch (error) {
      const retryable = !(error instanceof NotificationDeliveryError) || error.retryable;
      const safe = safeError(error);
      const retry = retryable && attempts < 5;
      const next = retry ? new Date(now.getTime() + retryDelayMs(attempts)).toISOString() : null;
      await db
        .prepare("UPDATE notifications SET next_delivery_at = ?, last_delivery_error = ? WHERE id = ?")
        .bind(next, safe, row.id)
        .run();
      if (retry) summary.retried += 1;
      else summary.failed += 1;
    }
  }
  return summary;
}

function safeError(error: unknown): string {
  return redact(error instanceof Error ? error.message : String(error))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .slice(0, 300);
}

function retryDelayMs(attempt: number): number {
  return [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000][Math.min(Math.max(attempt - 1, 0), 3)];
}
