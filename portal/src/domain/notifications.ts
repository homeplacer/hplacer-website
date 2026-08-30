/**
 * In-portal notifications.
 *
 * Who hears about what is **configuration, not code**. Every category has a
 * default role so a fresh database still notifies somebody, and an admin can
 * override that per category at `/admin/notifications` — adding roles, adding
 * named people, or removing the default entirely. Nothing in the domain layer
 * names a recipient; it names a category and lets routing decide.
 *
 * Delivery to email or SMS is a later transport. `notifications.delivered_at`
 * is the hook, and every row already carries a severity and a dedupe key.
 */
import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { isRole, type Role } from "../auth/authz.ts";

export type NotificationCategory =
  | "repair_reported"
  | "inventory_low"
  | "task_assigned"
  | "inspection_failed"
  | "defect_reported"
  | "material_requested"
  | "service_due"
  | "billing_ready"
  | "daily_digest"
  | "warranty_request"
  | "portable_john_request"
  | "job_application";

export interface NotificationInput {
  employeeId: string;
  category: NotificationCategory;
  severity?: "info" | "warning" | "urgent";
  title: string;
  body: string;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Repeat conditions (a part still below its reorder point) reuse this key so
   *  the same employee is alerted once, not once per sweep. */
  dedupeKey?: string | null;
}

export interface NotificationRow {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  related_type: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function notify(db: Db, input: NotificationInput): Promise<string | null> {
  const id = newId("ntf");
  try {
    await db
      .prepare(
        `INSERT INTO notifications (id, employee_id, category, severity, title, body, related_type, related_id, dedupe_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.employeeId,
        input.category,
        input.severity ?? "info",
        input.title,
        input.body,
        input.relatedType ?? null,
        input.relatedId ?? null,
        input.dedupeKey ?? null,
        nowIso(),
      )
      .run();
    return id;
  } catch (error) {
    // The dedupe index is the only uniqueness on this table; a collision means
    // the person has already been told.
    if (String(error).includes("UNIQUE")) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface CategoryRow {
  category: string;
  label: string;
  description: string | null;
  default_role: string;
  active: number;
}

export interface RouteRow {
  id: string;
  category: string;
  recipient_kind: string;
  recipient_role: string | null;
  recipient_employee_id: string | null;
  active: number;
}

export interface CategoryRouting extends CategoryRow {
  routes: (RouteRow & { recipient_name: string | null })[];
  /** True when nothing is configured and the default role is carrying it. */
  using_default: boolean;
}

export async function listCategories(db: Db): Promise<CategoryRow[]> {
  const rows = await db.prepare("SELECT * FROM notification_categories ORDER BY label").all<CategoryRow>();
  return rows.results;
}

export async function listRouting(db: Db): Promise<CategoryRouting[]> {
  const categories = await listCategories(db);
  const routes = await db
    .prepare(
      `SELECT r.*, e.display_name AS recipient_name
         FROM notification_routes r
         LEFT JOIN employees e ON e.id = r.recipient_employee_id
        ORDER BY r.recipient_kind, r.recipient_role, e.display_name`,
    )
    .all<RouteRow & { recipient_name: string | null }>();

  return categories.map((category) => {
    const forCategory = routes.results.filter((route) => route.category === category.category);
    return {
      ...category,
      routes: forCategory,
      using_default: forCategory.filter((route) => route.active === 1).length === 0,
    };
  });
}

/**
 * Resolves a category to a list of employee ids.
 *
 * With no active routes the category's default role is used, so a category can
 * never silently stop notifying anyone just because nobody has configured it.
 * Once routes exist they are authoritative — including the case where an admin
 * has deliberately narrowed a category down to one person.
 */
export async function recipientsFor(db: Db, category: NotificationCategory): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT e.id
         FROM notification_routes r
         JOIN employees e
           ON (r.recipient_kind = 'employee' AND e.id = r.recipient_employee_id)
           OR (r.recipient_kind = 'role' AND (e.role = r.recipient_role
                OR e.id IN (SELECT g.employee_id FROM employee_role_grants g WHERE g.role = r.recipient_role)))
        WHERE r.category = ? AND r.active = 1 AND e.active = 1`,
    )
    .bind(category)
    .all<{ id: string }>();

  if (rows.results.length > 0) return rows.results.map((row) => row.id);

  const fallback = await db
    .prepare(
      `SELECT e.id FROM notification_categories c
         JOIN employees e
           ON e.role = c.default_role
           OR e.id IN (SELECT g.employee_id FROM employee_role_grants g WHERE g.role = c.default_role)
        WHERE c.category = ? AND c.active = 1 AND e.active = 1`,
    )
    .bind(category)
    .all<{ id: string }>();
  return fallback.results.map((row) => row.id);
}

/** Sends one notification to everyone the routing table points at. */
export async function notifyCategory(db: Db, input: Omit<NotificationInput, "employeeId">): Promise<number> {
  const recipients = await recipientsFor(db, input.category);
  let sent = 0;
  for (const employeeId of recipients) {
    const id = await notify(db, { ...input, employeeId });
    if (id) sent += 1;
  }
  return sent;
}

export interface AddRouteInput {
  category: string;
  recipientKind: "role" | "employee";
  recipientRole?: Role | null;
  recipientEmployeeId?: string | null;
  createdBy?: string | null;
}

export async function addRoute(db: Db, input: AddRouteInput): Promise<string> {
  const category = await db
    .prepare("SELECT category FROM notification_categories WHERE category = ?")
    .bind(input.category)
    .first<{ category: string }>();
  if (!category) throw notFound(`No notification category called "${input.category}"`);

  if (input.recipientKind === "role") {
    if (!input.recipientRole || !isRole(input.recipientRole)) throw badRequest("Choose a role");
  } else if (!input.recipientEmployeeId) {
    throw badRequest("Choose a person");
  }

  const id = newId("nrt");
  try {
    await db
      .prepare(
        `INSERT INTO notification_routes (id, category, recipient_kind, recipient_role, recipient_employee_id, active, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        input.category,
        input.recipientKind,
        input.recipientKind === "role" ? input.recipientRole : null,
        input.recipientKind === "employee" ? input.recipientEmployeeId : null,
        input.createdBy ?? null,
        nowIso(),
      )
      .run();
    return id;
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      // Re-adding a recipient someone had switched off just switches it back on.
      await db
        .prepare(
          `UPDATE notification_routes SET active = 1
            WHERE category = ?1 AND recipient_kind = ?2
              AND ifnull(recipient_role, '') = ifnull(?3, '')
              AND ifnull(recipient_employee_id, '') = ifnull(?4, '')`,
        )
        .bind(
          input.category,
          input.recipientKind,
          input.recipientKind === "role" ? input.recipientRole : null,
          input.recipientKind === "employee" ? input.recipientEmployeeId : null,
        )
        .run();
      return id;
    }
    throw error;
  }
}

export async function removeRoute(db: Db, routeId: string): Promise<void> {
  const result = await db.prepare("DELETE FROM notification_routes WHERE id = ?").bind(routeId).run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Route not found");
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function inbox(db: Db, employeeId: string, limit = 50): Promise<NotificationRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, category, severity, title, body, related_type, related_id, read_at, created_at
         FROM notifications WHERE employee_id = ?
        ORDER BY read_at IS NOT NULL, created_at DESC, rowid DESC LIMIT ?`,
    )
    .bind(employeeId, limit)
    .all<NotificationRow>();
  return rows.results;
}

export async function unreadCount(db: Db, employeeId: string): Promise<number> {
  const row = await db
    .prepare("SELECT count(*) AS n FROM notifications WHERE employee_id = ? AND read_at IS NULL")
    .bind(employeeId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Scoped to the signed-in employee so one person cannot clear another's inbox. */
export async function markRead(db: Db, employeeId: string, notificationId: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND employee_id = ? AND read_at IS NULL")
    .bind(nowIso(), notificationId, employeeId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
