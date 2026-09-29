/**
 * Supervisor-assigned work tasks with due dates, status, and the evidence a
 * crew member attaches when they close one out.
 */
import { badRequest, forbidden, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { can, type Actor } from "../auth/authz.ts";
import { assetOptionLabel } from "./assets.ts";
import { notify } from "./notifications.ts";

export const TASK_STATUSES = ["open", "in_progress", "blocked", "complete", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  job_id: string | null;
  lot_id: string | null;
  home_id: string | null;
  asset_id: string | null;
  assigned_to: string | null;
  /** Comma-separated assignee ids returned by TASK_SELECT, including legacy assignments. */
  assignee_ids: string | null;
  created_by: string;
  requires_photo: number;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  created_at: string;
}

export interface TaskSummary extends TaskRow {
  assignee_name: string | null;
  created_by_name: string;
  completed_by_name: string | null;
  job_number: string | null;
  job_title: string | null;
  serial_number: string | null;
  monday_item_name: string | null;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_postal_code: string | null;
  asset_tag: string | null;
  equipment_count: number;
  evidence_count: number;
}

export interface TaskEquipment {
  id: string;
  asset_tag: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  model_year: number | null;
  status: string;
}

const TASK_SELECT = `
  SELECT t.*,
         coalesce((SELECT group_concat(e.display_name, ', ')
                     FROM work_task_assignees ta JOIN employees e ON e.id = ta.employee_id
                    WHERE ta.task_id = t.id), a.display_name) AS assignee_name,
         coalesce((SELECT group_concat(ta.employee_id, ',')
                     FROM work_task_assignees ta WHERE ta.task_id = t.id), t.assigned_to) AS assignee_ids,
         c.display_name AS created_by_name, d.display_name AS completed_by_name,
         j.job_number, j.title AS job_title, h.serial_number, h.monday_item_name, h.site_address, h.site_city, h.site_state, h.site_postal_code, s.asset_tag,
         (SELECT count(*) FROM work_task_assets ta WHERE ta.work_task_id = t.id) AS equipment_count,
         (SELECT count(*) FROM documents d WHERE d.work_task_id = t.id AND d.upload_status = 'stored') AS evidence_count
    FROM work_tasks t
    LEFT JOIN employees a ON a.id = t.assigned_to
    JOIN employees c ON c.id = t.created_by
    LEFT JOIN employees d ON d.id = t.completed_by
    LEFT JOIN jobs j ON j.id = t.job_id
    LEFT JOIN homes h ON h.id = t.home_id
    LEFT JOIN assets s ON s.id = t.asset_id`;

export interface TaskFilter {
  status?: string;
  assignedTo?: string;
  jobId?: string;
  openOnly?: boolean;
  availableOnly?: boolean;
  includeAvailableForCrew?: boolean;
  limit?: number;
}

/**
 * Row-level scoping happens here, not in the caller: without `task.read.all`
 * an employee sees tasks assigned to them or raised by them, plus unassigned
 * job-site tasks only where a caller explicitly requests that crew view.
 */
export async function listTasks(db: Db, actor: Actor, filter: TaskFilter = {}): Promise<TaskSummary[]> {
  const restrictToActor = can(actor, "task.read.all") ? null : actor.employeeId;
  const rows = await db
    .prepare(
      `${TASK_SELECT}
        WHERE (?1 IS NULL OR t.assigned_to = ?1 OR EXISTS (
                 SELECT 1 FROM work_task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id = ?1
               ) OR t.created_by = ?1 OR
               (?7 = 1 AND t.assigned_to IS NULL AND NOT EXISTS (
                 SELECT 1 FROM work_task_assignees ta WHERE ta.task_id = t.id
               ) AND (t.job_id IS NOT NULL OR t.lot_id IS NOT NULL OR t.home_id IS NOT NULL)))
          AND (?2 IS NULL OR t.status = ?2)
          AND (?3 IS NULL OR t.assigned_to = ?3 OR EXISTS (
                 SELECT 1 FROM work_task_assignees ta WHERE ta.task_id = t.id AND ta.employee_id = ?3
               ))
          AND (?4 IS NULL OR t.job_id = ?4)
          AND (?5 = 0 OR t.status IN ('open', 'in_progress', 'blocked'))
          AND (?8 = 0 OR (t.assigned_to IS NULL AND NOT EXISTS (
                 SELECT 1 FROM work_task_assignees ta WHERE ta.task_id = t.id
               ) AND (t.job_id IS NOT NULL OR t.lot_id IS NOT NULL OR t.home_id IS NOT NULL)
               AND t.status IN ('open', 'in_progress', 'blocked')))
        ORDER BY t.status IN ('complete', 'cancelled'),
                 CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                 t.due_at IS NULL, t.due_at
        LIMIT ?6`,
    )
    .bind(
      restrictToActor,
      filter.status ?? null,
      filter.assignedTo ?? null,
      filter.jobId ?? null,
      filter.openOnly ? 1 : 0,
      filter.limit ?? 100,
      filter.includeAvailableForCrew && can(actor, "job.read") ? 1 : 0,
      filter.availableOnly ? 1 : 0,
    )
    .all<TaskSummary>();
  return rows.results;
}

export async function getTask(db: Db, taskId: string): Promise<TaskSummary | null> {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).bind(taskId).first<TaskSummary>();
}

export async function listTaskEquipment(db: Db, taskId: string): Promise<TaskEquipment[]> {
  const rows = await db.prepare(
    `SELECT a.id, a.asset_tag, a.asset_type, a.manufacturer, a.model, a.model_year, a.status
       FROM work_task_assets ta JOIN assets a ON a.id = ta.asset_id
      WHERE ta.work_task_id = ?
      ORDER BY a.asset_type, a.manufacturer, a.model, a.asset_tag`,
  ).bind(taskId).all<TaskEquipment>();
  return rows.results;
}

export function taskEquipmentLabel(asset: TaskEquipment): string {
  return assetOptionLabel(asset);
}

export async function requireTask(db: Db, taskId: string): Promise<TaskSummary> {
  const task = await getTask(db, taskId);
  if (!task) throw notFound("Task not found");
  return task;
}

export interface CreateTaskInput {
  title: string;
  details?: string | null;
  priority?: string;
  dueAt?: string | null;
  assignedTo?: string | null;
  assignedToIds?: string[];
  jobId?: string | null;
  lotId?: string | null;
  homeId?: string | null;
  assetId?: string | null;
  assetIds?: string[];
  requiresPhoto?: boolean;
}

export async function createTask(db: Db, actor: Actor, input: CreateTaskInput): Promise<string> {
  if (!input.title.trim()) throw badRequest("Give the task a title");
  const priority = input.priority ?? "normal";
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) throw badRequest(`Unknown priority "${priority}"`);
  if (input.dueAt && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(input.dueAt)) {
    throw badRequest("Due date must look like 2026-08-30 or 2026-08-30 14:00");
  }

  const assetIds = [...new Set([...(input.assetIds ?? []), ...(input.assetId ? [input.assetId] : [])].map((id) => id.trim()).filter(Boolean))];
  if (input.jobId) {
    const job = await db.prepare("SELECT id FROM jobs WHERE id = ?").bind(input.jobId).first<{ id: string }>();
    if (!job) throw notFound("Selected subdivision not found");
  }
  if (input.homeId) {
    const home = await db.prepare("SELECT id, job_id FROM homes WHERE id = ?").bind(input.homeId)
      .first<{ id: string; job_id: string | null }>();
    if (!home) throw notFound("Selected home not found");
    if (input.jobId && home.job_id !== input.jobId) {
      throw badRequest("Choose a home that belongs to the selected subdivision");
    }
  }
  if (assetIds.length > 0 && !input.jobId && !input.homeId) {
    throw badRequest("Choose a subdivision or home as the destination for the equipment");
  }
  if (assetIds.length > 0) {
    const placeholders = assetIds.map(() => "?").join(", ");
    const assets = await db.prepare(`SELECT id, status FROM assets WHERE id IN (${placeholders})`).bind(...assetIds)
      .all<{ id: string; status: string }>();
    const found = new Map(assets.results.map((asset) => [asset.id, asset]));
    for (const assetId of assetIds) {
      const asset = found.get(assetId);
      if (!asset) throw notFound("One of the selected pieces of equipment was not found");
      if (asset.status === "retired") throw badRequest("Retired equipment cannot be put on a move task");
    }
  }

  const assigneeIds = normalizeAssigneeIds(input.assignedToIds ?? (input.assignedTo ? [input.assignedTo] : []));
  await requireActiveAssignees(db, assigneeIds);

  const id = newId("tsk");
  const timestamp = nowIso();
  const statements = [db.prepare(
      `INSERT INTO work_tasks (id, title, details, status, priority, due_at, job_id, lot_id, home_id, asset_id,
                               assigned_to, created_by, requires_photo, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.title.trim(),
      input.details?.trim() || null,
      priority,
      input.dueAt ?? null,
      input.jobId ?? null,
      input.lotId ?? null,
      input.homeId ?? null,
      assetIds[0] ?? null,
      assigneeIds[0] ?? null,
      actor.employeeId,
      input.requiresPhoto ? 1 : 0,
      timestamp,
      timestamp,
    ), ...assetIds.map((assetId) => db.prepare(
      "INSERT INTO work_task_assets (work_task_id, asset_id, created_at) VALUES (?, ?, ?)",
    ).bind(id, assetId, timestamp))];
  await db.batch(statements);

  if (assigneeIds.length) {
    await db.batch(assigneeIds.map((employeeId) => db.prepare(
      "INSERT INTO work_task_assignees (task_id, employee_id, assigned_by, assigned_at) VALUES (?, ?, ?, ?)",
    ).bind(id, employeeId, actor.employeeId, timestamp)));
  }

  for (const employeeId of assigneeIds) {
    await notify(db, {
      employeeId,
      category: "task_assigned",
      severity: priority === "urgent" ? "urgent" : "info",
      title: input.title.trim(),
      body: `${employeeId === actor.employeeId ? "You assigned yourself this task" : `${actor.displayName} assigned you this task`}${input.dueAt ? `, due ${input.dueAt}` : ""}.`,
      relatedType: "work_task",
      relatedId: id,
      emailEligible: true,
    });
  }
  return id;
}

export async function assignTask(db: Db, actor: Actor, taskId: string, employeeIds: string | string[] | null): Promise<void> {
  const task = await requireTask(db, taskId);
  const assigneeIds = normalizeAssigneeIds(Array.isArray(employeeIds) ? employeeIds : employeeIds ? [employeeIds] : []);
  await requireActiveAssignees(db, assigneeIds);
  const timestamp = nowIso();
  await db.batch([
    db.prepare("DELETE FROM work_task_assignees WHERE task_id = ?").bind(taskId),
    db.prepare("UPDATE work_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?").bind(assigneeIds[0] ?? null, timestamp, taskId),
    ...assigneeIds.map((id) => db.prepare(
      "INSERT INTO work_task_assignees (task_id, employee_id, assigned_by, assigned_at) VALUES (?, ?, ?, ?)",
    ).bind(taskId, id, actor.employeeId, timestamp)),
  ]);

  const previouslyAssigned = new Set((task.assignee_ids ?? task.assigned_to ?? "").split(",").filter(Boolean));
  for (const employeeId of assigneeIds.filter((id) => !previouslyAssigned.has(id))) {
    await notify(db, {
      employeeId,
      category: "task_assigned",
      title: task.title,
      body: employeeId === actor.employeeId ? "You assigned yourself this task." : `${actor.displayName} assigned you this task.`,
      relatedType: "work_task",
      relatedId: taskId,
      emailEligible: true,
    });
  }
}

function normalizeAssigneeIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function requireActiveAssignees(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db.prepare(`SELECT id, active, display_name FROM employees WHERE id IN (${placeholders})`)
    .bind(...ids).all<{ id: string; active: number; display_name: string }>();
  const byId = new Map(rows.results.map((row) => [row.id, row]));
  for (const id of ids) {
    const person = byId.get(id);
    if (!person) throw notFound("Assignee not found");
    if (person.active !== 1) throw badRequest(`${person.display_name} is deactivated`);
  }
}

export async function setTaskStatus(db: Db, actor: Actor, taskId: string, status: TaskStatus): Promise<void> {
  if (!(TASK_STATUSES as readonly string[]).includes(status)) throw badRequest(`Unknown status "${status}"`);
  if (status === "complete") throw badRequest("Use the completion form so the evidence is captured");

  const task = await requireTask(db, taskId);
  assertCanWorkTask(actor, task);
  await db
    .prepare("UPDATE work_tasks SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowIso(), taskId)
    .run();
}

export interface CompleteTaskInput {
  taskId: string;
  notes?: string | null;
}

/**
 * Closing a task requires notes, and a photo too when the supervisor asked for
 * one. The photo count is read back from `documents` rather than trusted from
 * the request body.
 */
export async function completeTask(db: Db, actor: Actor, input: CompleteTaskInput): Promise<void> {
  const task = await requireTask(db, input.taskId);
  assertCanWorkTask(actor, task);
  if (task.status === "complete") throw badRequest("This task is already complete");
  if (task.status === "cancelled") throw badRequest("This task was cancelled");
  if (!input.notes?.trim()) throw badRequest("Say what you did before closing the task");

  if (task.requires_photo === 1) {
    const evidence = await db
      .prepare("SELECT count(*) AS n FROM documents WHERE work_task_id = ? AND upload_status = 'stored' AND document_type = 'photo'")
      .bind(task.id)
      .first<{ n: number }>();
    if ((evidence?.n ?? 0) === 0) throw badRequest("This task needs a photo before it can be closed");
  }

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE work_tasks SET status = 'complete', completed_at = ?, completed_by = ?, completion_notes = ?, updated_at = ?
        WHERE id = ? AND status IN ('open', 'in_progress', 'blocked') AND assigned_to IS ?`,
    )
    .bind(timestamp, actor.employeeId, input.notes.trim(), timestamp, task.id, task.assigned_to)
    .run();
  if (result.meta.changes !== 1) throw badRequest("This task changed. Refresh before completing it.");

  if (task.created_by !== actor.employeeId) {
    await notify(db, {
      employeeId: task.created_by,
      category: "task_assigned",
      title: `Completed: ${task.title}`,
      body: `${actor.displayName} closed this task. ${input.notes.trim()}`,
      relatedType: "work_task",
      relatedId: task.id,
    });
  }
}

/** Crew may open unassigned tasks tied to a home-placement job, lot, or home. */
export function isAvailableToCrew(actor: Actor, task: Pick<TaskRow, "assigned_to" | "job_id" | "lot_id" | "home_id">): boolean {
  return can(actor, "job.read") && task.assigned_to === null &&
    (task.job_id !== null || task.lot_id !== null || task.home_id !== null);
}

function assertCanWorkTask(actor: Actor, task: TaskRow): void {
  if (can(actor, "task.complete.any")) return;
  if (task.assigned_to === actor.employeeId || (task.assignee_ids ?? "").split(",").includes(actor.employeeId) || task.created_by === actor.employeeId) return;
  if (isAvailableToCrew(actor, task)) return;
  throw forbidden("That task is assigned to someone else");
}

export async function overdueTasks(db: Db, now: Date = new Date()): Promise<TaskSummary[]> {
  const rows = await db
    .prepare(
      `${TASK_SELECT}
        WHERE t.status IN ('open', 'in_progress', 'blocked') AND t.due_at IS NOT NULL AND t.due_at < ?
        ORDER BY t.due_at`,
    )
    .bind(nowIso(now))
    .all<TaskSummary>();
  return rows.results;
}
