/**
 * Web Push for the installed portal app: device subscriptions and the durable
 * task-assignment outbox.
 *
 * - A subscription belongs to exactly one employee. The browser endpoint is a
 *   capability, so it is hashed for uniqueness, never returned by any route,
 *   and never written to logs or error text.
 * - Outbox rows are written in the same batch as the in-portal notification
 *   (see `notify`) and only for subscriptions that exist at that moment, so
 *   adding a device or turning push on never replays older alerts. Rows older
 *   than the delivery window expire unsent.
 * - Each row is claimed with an atomic lease before sending, so the cron and a
 *   request-time drain cannot both send it. A lease that outlives a crashed
 *   attempt is reclaimed after it expires.
 * - At send time the employee must still be active, still own the device, and
 *   still be assigned to an open task; otherwise the row is skipped.
 * - The payload is generic: no task title, address, or names leave the portal.
 *   The device shows it from the encrypted payload alone, which still works
 *   when the Cloudflare Access session has expired; tapping it opens the task
 *   through the normal Access sign-in.
 */
import { badRequest, notFound, PortalError } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, PortalEnv } from "../platform/types.ts";
import {
  base64UrlEncode,
  loadWebPushConfig,
  pushServiceFor,
  sha256Hex,
  validatePushEndpoint,
  validateSubscriptionKeys,
  WebPushConfigError,
  WebPushSender,
  type PushMessage,
  type PushOutcome,
  type PushSender,
  type PushService,
} from "../integrations/web-push.ts";

export const MAX_DEVICES_PER_EMPLOYEE = 10;
export const MAX_DELIVERY_ATTEMPTS = 5;
/** Alerts older than this are expired, not sent: a stale "new task" is noise. */
export const DELIVERY_WINDOW_MS = 12 * 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const TEST_ALERT_INTERVAL_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface SubscriptionInput {
  endpoint: unknown;
  p256dh: unknown;
  auth: unknown;
}

export interface RegisterResult {
  id: string;
  /** True when this endpoint previously belonged to another employee. */
  transferred: boolean;
  created: boolean;
}

function invalidSubscription(error: unknown): PortalError {
  const code = error instanceof WebPushConfigError ? error.code : "invalid";
  return badRequest("That browser subscription is not valid for portal alerts", code);
}

/**
 * Binds a browser push endpoint to the signed-in employee. If the same
 * endpoint is bound to someone else — a shared phone that switched accounts —
 * the old binding and its queued alerts are removed first, in one batch, so the
 * endpoint is never bound to two people.
 */
export async function registerSubscription(db: Db, employeeId: string, input: SubscriptionInput, now: Date = new Date()): Promise<RegisterResult> {
  let endpoint: URL;
  try {
    endpoint = validatePushEndpoint(input.endpoint);
    await validateSubscriptionKeys(input.p256dh, input.auth);
  } catch (error) {
    throw invalidSubscription(error);
  }
  const endpointText = endpoint.toString();
  const hash = await sha256Hex(endpointText);
  const p256dh = String(input.p256dh);
  const auth = String(input.auth);
  const timestamp = nowIso(now);

  const existing = await db
    .prepare("SELECT id, employee_id FROM push_subscriptions WHERE endpoint_hash = ?")
    .bind(hash)
    .first<{ id: string; employee_id: string }>();

  if (existing && existing.employee_id === employeeId) {
    await db
      .prepare("UPDATE push_subscriptions SET p256dh = ?, auth_secret = ?, updated_at = ?, failure_count = 0 WHERE id = ? AND employee_id = ?")
      .bind(p256dh, auth, timestamp, existing.id, employeeId)
      .run();
    return { id: existing.id, transferred: false, created: false };
  }

  const count = await db
    .prepare("SELECT count(*) AS n FROM push_subscriptions WHERE employee_id = ?")
    .bind(employeeId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_DEVICES_PER_EMPLOYEE) {
    throw badRequest(`You already have ${MAX_DEVICES_PER_EMPLOYEE} devices receiving alerts. Remove one first.`);
  }

  const id = newId("psub", now);
  const statements = [];
  if (existing) statements.push(...removalStatements(db, existing.id, "device_reassigned"));
  statements.push(
    db.prepare(
      `INSERT INTO push_subscriptions (id, employee_id, endpoint, endpoint_hash, push_host, p256dh, auth_secret, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, employeeId, endpointText, hash, endpoint.hostname.toLowerCase(), p256dh, auth, timestamp, timestamp),
  );
  await db.batch(statements);
  return { id, transferred: Boolean(existing), created: true };
}

function removalStatements(db: Db, subscriptionId: string, reason: string) {
  return [
    db.prepare(
      `UPDATE push_deliveries SET status = 'cancelled', lease_until = NULL, claim_token = NULL, last_error = ?
        WHERE subscription_id = ? AND status IN ('pending', 'sending')`,
    ).bind(reason, subscriptionId),
    db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(subscriptionId),
  ];
}

async function removeSubscription(db: Db, subscriptionId: string, reason: string): Promise<void> {
  await db.batch(removalStatements(db, subscriptionId, reason));
}

/** True only when this endpoint is bound to this employee. Reveals nothing about anyone else. */
export async function isRegistered(db: Db, employeeId: string, endpoint: unknown): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = validatePushEndpoint(endpoint);
  } catch {
    return false;
  }
  const row = await db
    .prepare("SELECT 1 AS ok FROM push_subscriptions WHERE endpoint_hash = ? AND employee_id = ?")
    .bind(await sha256Hex(url.toString()), employeeId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** Removes the caller's own binding for an endpoint. Someone else's is left alone. */
export async function unregisterEndpoint(db: Db, employeeId: string, endpoint: unknown): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = validatePushEndpoint(endpoint);
  } catch {
    return false;
  }
  const row = await db
    .prepare("SELECT id FROM push_subscriptions WHERE endpoint_hash = ? AND employee_id = ?")
    .bind(await sha256Hex(url.toString()), employeeId)
    .first<{ id: string }>();
  if (!row) return false;
  await removeSubscription(db, row.id, "unsubscribed");
  return true;
}

/** Device-list removal, scoped so one employee cannot remove another's device. */
export async function unregisterDevice(db: Db, employeeId: string, subscriptionId: string): Promise<void> {
  const row = await db
    .prepare("SELECT id FROM push_subscriptions WHERE id = ? AND employee_id = ?")
    .bind(subscriptionId, employeeId)
    .first<{ id: string }>();
  if (!row) throw notFound("Device not found");
  await removeSubscription(db, row.id, "unsubscribed");
}

export interface DeviceSummary {
  id: string;
  service: PushService | null;
  created_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
}

/** The caller's devices. Endpoints and keys are deliberately not selected. */
export async function listDevices(db: Db, employeeId: string): Promise<DeviceSummary[]> {
  const rows = await db
    .prepare(
      `SELECT id, push_host, created_at, last_success_at, last_failure_at
         FROM push_subscriptions WHERE employee_id = ? ORDER BY created_at DESC`,
    )
    .bind(employeeId)
    .all<{ id: string; push_host: string; created_at: string; last_success_at: string | null; last_failure_at: string | null }>();
  return rows.results.map((row) => ({
    id: row.id,
    service: pushServiceFor(row.push_host),
    created_at: row.created_at,
    last_success_at: row.last_success_at,
    last_failure_at: row.last_failure_at,
  }));
}

export function deviceLabel(service: PushService | null): string {
  switch (service) {
    case "apple":
      return "iPhone, iPad, or Mac (Apple)";
    case "google":
      return "Chrome or Android (Google)";
    case "mozilla":
      return "Firefox (Mozilla)";
    case "microsoft":
      return "Windows (Microsoft)";
    default:
      return "Browser";
  }
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

/**
 * Statement that queues one delivery per device the employee has right now.
 * `notify` runs it in the same batch as the notification insert.
 */
export function enqueuePushStatement(db: Db, notificationId: string, employeeId: string, timestamp: string) {
  return db.prepare(
    `INSERT INTO push_deliveries (id, notification_id, subscription_id, employee_id, status, attempts, next_attempt_at, created_at)
     SELECT 'pdl_' || lower(hex(randomblob(10))), ?, s.id, s.employee_id, 'pending', 0, ?, ?
       FROM push_subscriptions s WHERE s.employee_id = ?`,
  ).bind(notificationId, timestamp, timestamp, employeeId);
}

export interface PushDispatchSummary {
  sent: number;
  retried: number;
  failed: number;
  gone: number;
  skipped: number;
  expired: number;
}

interface DeliveryContext {
  id: string;
  attempts: number;
  notification_id: string;
  category: string;
  severity: string;
  related_type: string | null;
  related_id: string | null;
  subscription_id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth_secret: string | null;
  employee_active: number;
  still_assigned: number | null;
  created_at: string;
}

export interface DispatchOptions {
  /** Clock read fresh for every row; a fixed Date is a test convenience. */
  now?: Date | (() => Date);
  limit?: number;
  /**
   * Stop claiming new rows once this much wall time has passed. One send can
   * still take the sender's timeout after that, so budget + timeout must stay
   * inside the caller's runtime limit.
   */
  budgetMs?: number;
}

/** Request-time drain (Workers `waitUntil` allows ~30 s): ≤12 s of claims + one ≤10 s send. */
export const IMMEDIATE_DRAIN = { limit: 10, budgetMs: 12_000 } as const;

export async function dispatchPushOutbox(db: Db, sender: PushSender, options: DispatchOptions = {}): Promise<PushDispatchSummary> {
  const fixed = options.now;
  const clock = typeof fixed === "function" ? fixed : () => fixed ?? new Date();
  const start = clock();
  const nowText = nowIso(start);
  const summary: PushDispatchSummary = { sent: 0, retried: 0, failed: 0, gone: 0, skipped: 0, expired: 0 };

  const expired = await db
    .prepare(
      `UPDATE push_deliveries SET status = 'expired', lease_until = NULL, claim_token = NULL, last_error = 'outside_delivery_window'
        WHERE created_at < ?
          AND (status = 'pending' OR (status = 'sending' AND lease_until <= ?))`,
    )
    .bind(nowIso(new Date(start.getTime() - DELIVERY_WINDOW_MS)), nowText)
    .run();
  summary.expired = expired.meta.changes ?? 0;

  const exhausted = await db
    .prepare(
      `UPDATE push_deliveries SET status = 'failed', lease_until = NULL, claim_token = NULL, last_error = coalesce(last_error, 'attempts_exhausted')
        WHERE status = 'sending' AND lease_until <= ? AND attempts >= ?`,
    )
    .bind(nowText, MAX_DELIVERY_ATTEMPTS)
    .run();
  summary.failed += exhausted.meta.changes ?? 0;

  const due = await db
    .prepare(
      `SELECT id FROM push_deliveries
        WHERE (status = 'pending' AND next_attempt_at <= ?1) OR (status = 'sending' AND lease_until <= ?1)
        ORDER BY created_at, id LIMIT ?2`,
    )
    .bind(nowText, Math.min(Math.max(options.limit ?? 50, 1), 200))
    .all<{ id: string }>();

  const startedAt = Date.now();
  for (const { id } of due.results) {
    if (options.budgetMs !== undefined && Date.now() - startedAt >= options.budgetMs) break;
    // Fresh clock per row: a slow earlier send must not hand later rows a lease
    // that is already expired when claimed.
    const rowNow = clock();
    const rowNowText = nowIso(rowNow);
    const token = newId("clm", rowNow);
    const claim = await db
      .prepare(
        `UPDATE push_deliveries SET status = 'sending', attempts = attempts + 1, lease_until = ?, claim_token = ?
          WHERE id = ? AND attempts < ?
            AND ((status = 'pending' AND next_attempt_at <= ?) OR (status = 'sending' AND lease_until <= ?))`,
      )
      .bind(nowIso(new Date(rowNow.getTime() + LEASE_MS)), token, id, MAX_DELIVERY_ATTEMPTS, rowNowText, rowNowText)
      .run();
    if ((claim.meta.changes ?? 0) !== 1) continue; // Another worker holds it.

    const delivery = await loadDeliveryContext(db, id);
    const skip = skipReason(delivery);
    if (skip || !delivery) {
      if (await finish(db, id, token, "skipped", null, skip ?? "missing")) summary.skipped += 1;
      continue;
    }

    const message = await taskAlertMessage(delivery, rowNow);
    let outcome: PushOutcome;
    try {
      outcome = await sender.send(
        { endpoint: delivery.endpoint!, p256dh: delivery.p256dh!, auth: delivery.auth_secret! },
        message,
      );
    } catch {
      outcome = { kind: "retry", status: null, retryAfterSeconds: null, code: "sender_exception" };
    }
    await applyOutcome(db, delivery, token, outcome, clock(), summary);
  }
  return summary;
}

async function loadDeliveryContext(db: Db, id: string): Promise<DeliveryContext | null> {
  return db
    .prepare(
      `SELECT d.id, d.attempts, d.notification_id, d.created_at,
              n.category, n.severity, n.related_type, n.related_id,
              s.id AS subscription_id, s.endpoint, s.p256dh, s.auth_secret,
              e.active AS employee_active,
              (SELECT 1 FROM work_tasks t
                WHERE n.related_type = 'work_task' AND t.id = n.related_id
                  AND t.status IN ('open', 'in_progress', 'blocked')
                  AND (t.assigned_to = d.employee_id OR EXISTS (
                        SELECT 1 FROM work_task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id = d.employee_id))) AS still_assigned
         FROM push_deliveries d
         JOIN notifications n ON n.id = d.notification_id AND n.employee_id = d.employee_id
         JOIN employees e ON e.id = d.employee_id
         LEFT JOIN push_subscriptions s ON s.id = d.subscription_id AND s.employee_id = d.employee_id
        WHERE d.id = ?`,
    )
    .bind(id)
    .first<DeliveryContext>();
}

function skipReason(delivery: DeliveryContext | null): string | null {
  if (!delivery) return "notification_mismatch";
  if (!delivery.subscription_id || !delivery.endpoint) return "device_removed";
  if (delivery.employee_active !== 1) return "employee_inactive";
  if (delivery.category !== "task_assigned" || delivery.related_type !== "work_task" || !delivery.related_id) return "not_task_assignment";
  if (delivery.still_assigned !== 1) return "no_longer_assigned";
  return null;
}

/** Same-origin relative path only; the service worker re-checks it. */
export function taskPath(taskId: string): string {
  return `/tasks/${encodeURIComponent(taskId)}`;
}

async function topicFor(notificationId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(notificationId)));
  return base64UrlEncode(digest).slice(0, 32);
}

/** Generic by design: the lock screen never shows a task title, place, or name. */
export async function taskAlertMessage(delivery: Pick<DeliveryContext, "notification_id" | "severity" | "related_id" | "created_at">, now: Date): Promise<PushMessage> {
  const urgent = delivery.severity === "urgent";
  const ageMs = Math.max(0, now.getTime() - Date.parse(`${delivery.created_at.replace(" ", "T")}Z`));
  return {
    payload: {
      v: 1,
      title: "Home Placer",
      body: urgent ? "You have a new urgent task assignment." : "You have a new task assignment.",
      url: taskPath(delivery.related_id ?? ""),
      // Per-notification tag: a duplicate push replaces, rather than stacks, the alert.
      tag: `ntf-${delivery.notification_id}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64),
    },
    ttlSeconds: Math.max(60, Math.floor((DELIVERY_WINDOW_MS - (Number.isFinite(ageMs) ? ageMs : 0)) / 1000)),
    urgency: urgent ? "high" : "normal",
    topic: await topicFor(delivery.notification_id),
  };
}

function retryDelayMs(attempt: number): number {
  return [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000][Math.min(Math.max(attempt - 1, 0), 3)];
}

/**
 * Records an outcome only if this sender still holds the claim. Returns false
 * when the lease was reclaimed meanwhile; the newer claim owns the row.
 */
async function finish(db: Db, id: string, token: string, status: string, httpStatus: number | null, error: string | null, now?: Date): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE push_deliveries SET status = ?, lease_until = NULL, claim_token = NULL, last_status = ?, last_error = ?, sent_at = ?
        WHERE id = ? AND status = 'sending' AND claim_token = ?`,
    )
    .bind(status, httpStatus, error, status === "sent" && now ? nowIso(now) : null, id, token)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

async function applyOutcome(db: Db, delivery: DeliveryContext, token: string, outcome: PushOutcome, now: Date, summary: PushDispatchSummary): Promise<void> {
  const subscriptionId = delivery.subscription_id!;
  switch (outcome.kind) {
    case "sent":
      if (!(await finish(db, delivery.id, token, "sent", outcome.status, null, now))) return;
      await db
        .prepare("UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE id = ?")
        .bind(nowIso(now), subscriptionId)
        .run();
      summary.sent += 1;
      return;
    case "gone":
      // The push service said the endpoint is dead; drop it even if fenced out.
      if (await finish(db, delivery.id, token, "gone", outcome.status, "subscription_expired")) summary.gone += 1;
      await removeSubscription(db, subscriptionId, "subscription_expired");
      return;
    case "retry": {
      // Loaded after the claim, so this already counts the current attempt.
      const attempts = delivery.attempts;
      if (attempts >= MAX_DELIVERY_ATTEMPTS) {
        if (!(await finish(db, delivery.id, token, "failed", outcome.status, outcome.code))) return;
        await markDeviceFailure(db, subscriptionId, now);
        summary.failed += 1;
        return;
      }
      const delay = Math.max(retryDelayMs(attempts), (outcome.retryAfterSeconds ?? 0) * 1000);
      const result = await db
        .prepare(
          `UPDATE push_deliveries SET status = 'pending', lease_until = NULL, claim_token = NULL, next_attempt_at = ?, last_status = ?, last_error = ?
            WHERE id = ? AND status = 'sending' AND claim_token = ?`,
        )
        .bind(nowIso(new Date(now.getTime() + delay)), outcome.status, outcome.code, delivery.id, token)
        .run();
      if ((result.meta.changes ?? 0) !== 1) return;
      await markDeviceFailure(db, subscriptionId, now);
      summary.retried += 1;
      return;
    }
    case "rejected":
      if (!(await finish(db, delivery.id, token, "failed", outcome.status, outcome.code))) return;
      await markDeviceFailure(db, subscriptionId, now);
      summary.failed += 1;
      return;
  }
}

async function markDeviceFailure(db: Db, subscriptionId: string, now: Date): Promise<void> {
  await db
    .prepare("UPDATE push_subscriptions SET last_failure_at = ?, failure_count = failure_count + 1 WHERE id = ?")
    .bind(nowIso(now), subscriptionId)
    .run();
}

// ---------------------------------------------------------------------------
// Test alert
// ---------------------------------------------------------------------------

export interface TestAlertResult {
  devices: number;
  sent: number;
  failed: number;
  removed: number;
}

/** Sends a generic test alert to the caller's own devices only. Rate limited. */
export async function sendTestAlert(db: Db, sender: PushSender, employeeId: string, now: Date = new Date()): Promise<TestAlertResult> {
  const recent = await db
    .prepare("SELECT max(last_test_at) AS last FROM push_subscriptions WHERE employee_id = ?")
    .bind(employeeId)
    .first<{ last: string | null }>();
  if (recent?.last && now.getTime() - Date.parse(`${recent.last.replace(" ", "T")}Z`) < TEST_ALERT_INTERVAL_MS) {
    throw new PortalError(429, "too_many_requests", "A test alert was just sent. Wait half a minute before sending another.");
  }
  const devices = await db
    .prepare("SELECT id, endpoint, p256dh, auth_secret FROM push_subscriptions WHERE employee_id = ?")
    .bind(employeeId)
    .all<{ id: string; endpoint: string; p256dh: string; auth_secret: string }>();
  const result: TestAlertResult = { devices: devices.results.length, sent: 0, failed: 0, removed: 0 };
  if (devices.results.length === 0) return result;
  await db.prepare("UPDATE push_subscriptions SET last_test_at = ? WHERE employee_id = ?").bind(nowIso(now), employeeId).run();

  const message: PushMessage = {
    payload: { v: 1, title: "Home Placer", body: "Test alert: phone alerts are working.", url: "/notifications", tag: `test-${now.getTime()}` },
    ttlSeconds: 300,
    urgency: "normal",
  };
  for (const device of devices.results) {
    let outcome: PushOutcome;
    try {
      outcome = await sender.send({ endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth_secret }, message);
    } catch {
      outcome = { kind: "retry", status: null, retryAfterSeconds: null, code: "sender_exception" };
    }
    if (outcome.kind === "sent") {
      result.sent += 1;
      await db.prepare("UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE id = ?").bind(nowIso(now), device.id).run();
    } else if (outcome.kind === "gone") {
      result.removed += 1;
      await removeSubscription(db, device.id, "subscription_expired");
    } else {
      result.failed += 1;
      await markDeviceFailure(db, device.id, now);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------

export interface PushRunSummary extends PushDispatchSummary {
  enabled: boolean;
}

/** Drains the outbox. A no-op unless push is explicitly enabled and fully configured. */
export async function runWebPush(env: PortalEnv, fetcher: typeof fetch = fetch, options: DispatchOptions = {}): Promise<PushRunSummary> {
  const keys = env.PORTAL_DB ? await loadWebPushConfig(env) : null;
  if (!keys) return { enabled: false, sent: 0, retried: 0, failed: 0, gone: 0, skipped: 0, expired: 0 };
  const result = await dispatchPushOutbox(env.PORTAL_DB, new WebPushSender(keys, fetcher), options);
  return { enabled: true, ...result };
}
