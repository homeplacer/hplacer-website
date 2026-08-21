/**
 * Supervisor-assigned work tasks with due dates, status, and the evidence a
 * crew member attaches when they close one out.
 */
import { badRequest, forbidden, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { can, type Actor } from "../auth/authz.ts";
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
  job_number: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  evidence_count: number;
}

const TASK_SELECT = `
  SELECT t.*, a.display_name AS assignee_name, c.display_name AS created_by_name,
         j.job_number, h.serial_number, s.asset_tag,
         (SELECT count(*) FROM documents d WHERE d.work_task_id = t.id AND d.upload_status = 'stored') AS evidence_count
    FROM work_tasks t
    LEFT JOIN employees a ON a.id = t.assigned_to
    JOIN employees c ON c.id = t.created_by
    LEFT JOIN jobs j ON j.id = t.job_id
    LEFT JOIN homes h ON h.id = t.home_id
    LEFT JOIN assets s ON s.id = t.asset_id`;

export interface TaskFilter {
  status?: string;
  assignedTo?: string;
  jobId?: string;
  openOnly?: boolean;
  limit?: number;
}

/**
 * Row-level scoping happens here, not in the caller: without `task.read.all`
 * an employee only ever sees tasks assigned to them or raised by them.
 */
export async function listTasks(db: Db, actor: Actor, filter: TaskFilter = {}): Promise<TaskSummary[]> {
  const restrictToActor = can(actor, "task.read.all") ? null : actor.employeeId;
  const rows = await db
    .prepare(
      `${TASK_SELECT}
        WHERE (?1 IS NULL OR t.assigned_to = ?1 OR t.created_by = ?1)
          AND (?2 IS NULL OR t.status = ?2)
          AND (?3 IS NULL OR t.assigned_to = ?3)
          AND (?4 IS NULL OR t.job_id = ?4)
          AND (?5 = 0 OR t.status IN ('open', 'in_progress', 'blocked'))
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
    )
    .all<TaskSummary>();
  return rows.results;
}

export async function getTask(db: Db, taskId: string): Promise<TaskSummary | null> {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).bind(taskId).first<TaskSummary>();
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
  jobId?: string | null;
  lotId?: string | null;
  homeId?: string | null;
  assetId?: string | null;
  requiresPhoto?: boolean;
}

export async function createTask(db: Db, actor: Actor, input: CreateTaskInput): Promise<string> {
  if (!input.title.trim()) throw badRequest("Give the task a title");
  const priority = input.priority ?? "normal";
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) throw badRequest(`Unknown priority "${priority}"`);
  if (input.dueAt && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(input.dueAt)) {
    throw badRequest("Due date must look like 2026-08-30 or 2026-08-30 14:00");
  }

  if (input.assignedTo) {
    const assignee = await db
      .prepare("SELECT id, active, display_name FROM employees WHERE id = ?")
      .bind(input.assignedTo)
      .first<{ id: string; active: number; display_name: string }>();
    if (!assignee) throw notFound("Assignee not found");
    if (assignee.active !== 1) throw badRequest(`${assignee.display_name} is deactivated`);
  }

  const id = newId("tsk");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO work_tasks (id, title, details, status, priority, due_at, job_id, lot_id, home_id, asset_id,
                               assigned_to, created_by, requires_photo, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title.trim(),
      input.details?.trim() || null,
      priority,
      input.dueAt ?? null,
      input.jobId ?? null,
      input.lotId ?? null,
      input.homeId ?? null,
      input.assetId ?? null,
      input.assignedTo ?? null,
      actor.employeeId,
      input.requiresPhoto ? 1 : 0,
      timestamp,
      timestamp,
    )
    .run();

  if (input.assignedTo && input.assignedTo !== actor.employeeId) {
    await notify(db, {
      employeeId: input.assignedTo,
      category: "task_assigned",
      severity: priority === "urgent" ? "urgent" : "info",
      title: input.title.trim(),
      body: `${actor.displayName} assigned you this task${input.dueAt ? `, due ${input.dueAt}` : ""}.`,
      relatedType: "work_task",
      relatedId: id,
    });
  }
  return id;
}

export async function assignTask(db: Db, actor: Actor, taskId: string, employeeId: string | null): Promise<void> {
  const task = await requireTask(db, taskId);
  await db
    .prepare("UPDATE work_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?")
    .bind(employeeId, nowIso(), taskId)
    .run();

  if (employeeId && employeeId !== actor.employeeId) {
    await notify(db, {
      employeeId,
      category: "task_assigned",
      title: task.title,
      body: `${actor.displayName} assigned you this task.`,
      relatedType: "work_task",
      relatedId: taskId,
    });
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
      .prepare("SELECT count(*) AS n FROM documents WHERE work_task_id = ? AND upload_status = 'stored'")
      .bind(task.id)
      .first<{ n: number }>();
    if ((evidence?.n ?? 0) === 0) throw badRequest("This task needs a photo before it can be closed");
  }

  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE work_tasks SET status = 'complete', completed_at = ?, completed_by = ?, completion_notes = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(timestamp, actor.employeeId, input.notes.trim(), timestamp, task.id)
    .run();

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

function assertCanWorkTask(actor: Actor, task: TaskRow): void {
  if (can(actor, "task.complete.any")) return;
  if (task.assigned_to === actor.employeeId || task.created_by === actor.employeeId) return;
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
