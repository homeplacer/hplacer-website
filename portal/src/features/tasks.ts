/** Supervisor-assigned tasks and the completion evidence that closes them. */
import { assertCan, can } from "../auth/authz.ts";
import { listEmployees } from "../domain/employees.ts";
import { listDocuments } from "../domain/documents.ts";
import { listJobs } from "../domain/jobs.ts";
import { listAssets } from "../domain/assets.ts";
import { listHomes } from "../domain/homes.ts";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  assignTask,
  completeTask,
  createTask,
  listTasks,
  requireTask,
  setTaskStatus,
  type TaskStatus,
} from "../domain/tasks.ts";
import { forbidden } from "../platform/errors.ts";
import { boolField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query, raw } from "../ui/html.ts";
import { badge, empty, formatDate, kv, page, tabs } from "../ui/layout.ts";
import { documentList, uploadForm } from "./documents.ts";
import { wantsJson } from "./equipment.ts";

export function registerTasks(router: Router): void {
  router.get("/tasks", renderList);
  router.get("/tasks/new", renderNewTask);
  router.get("/tasks/:id", renderDetail);

  router.post("/api/tasks", createTaskRoute);
  router.post("/api/tasks/:id/status", setStatusRoute);
  router.post("/api/tasks/:id/assign", assignRoute);
  router.post("/api/tasks/:id/complete", completeRoute);

  router.get("/api/tasks", async (ctx) =>
    json({
      tasks: await listTasks(ctx.db, ctx.actor, {
        status: ctx.url.searchParams.get("status") ?? undefined,
        assignedTo: ctx.url.searchParams.get("assignedTo") ?? undefined,
        openOnly: ctx.url.searchParams.get("open") === "1",
      }),
    }),
  );
}

async function renderList(ctx: RequestContext): Promise<Response> {
  const scope = ctx.url.searchParams.get("scope") ?? "mine";
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const canSeeAll = can(ctx.actor, "task.read.all");

  const tasks = await listTasks(ctx.db, ctx.actor, {
    status,
    assignedTo: scope === "mine" ? ctx.actor.employeeId : undefined,
    openOnly: !status,
  });

  const body = html`
    <h1>Tasks</h1>
    ${tabs([
      { href: "/tasks?scope=mine", label: "Mine", current: scope === "mine" },
      ...(canSeeAll ? [{ href: "/tasks?scope=all", label: "Everyone", current: scope === "all" }] : []),
      ...TASK_STATUSES.map((value) => ({
        href: `/tasks${query({ scope, status: value })}`,
        label: value.replace(/_/g, " "),
        current: status === value,
      })),
    ])}

    ${tasks.length === 0
      ? empty("No tasks here.")
      : tasks.map(
          (task) => html`<a class="card" href="/tasks/${task.id}">
            <div class="row"><h3>${task.title}</h3>
              ${badge(task.priority, task.priority === "urgent" ? "bad" : task.priority === "high" ? "warn" : "")}</div>
            <div class="meta">${badge(task.status, task.status === "complete" ? "ok" : task.status === "blocked" ? "warn" : "")}
              ${task.assignee_name ?? "Unassigned"}${task.due_at ? ` · due ${formatDate(task.due_at)}` : ""}
              ${task.job_number ? ` · ${task.job_number}` : ""}${task.asset_tag ? ` · ${task.asset_tag}` : ""}
              ${task.requires_photo === 1 ? " · photo required" : ""}</div>
          </a>`,
        )}

    ${can(ctx.actor, "task.assign") ? html`<div class="btn-row"><a class="btn" href="/tasks/new">Assign a task</a></div>` : ""}
  `;
  return page(body, { title: "Tasks", actor: ctx.actor, section: "/tasks", flash: flashFrom(ctx.url) });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  const task = await requireTask(ctx.db, ctx.params.id);
  if (!can(ctx.actor, "task.read.all") && task.assigned_to !== ctx.actor.employeeId && task.created_by !== ctx.actor.employeeId) {
    throw forbidden("That task is assigned to someone else");
  }
  const evidence = await listDocuments(ctx.db, { workTaskId: task.id });
  const canWork = can(ctx.actor, "task.complete.any") || task.assigned_to === ctx.actor.employeeId || task.created_by === ctx.actor.employeeId;
  const employees = can(ctx.actor, "task.assign") ? await listEmployees(ctx.db) : [];

  const body = html`
    <h1>${task.title}</h1>
    <p class="lede">${badge(task.status, task.status === "complete" ? "ok" : "")} ${badge(task.priority, task.priority === "urgent" ? "bad" : "")}</p>

    <div class="card">
      ${kv([
        ["Assigned to", task.assignee_name ?? "Unassigned"],
        ["Raised by", task.created_by_name],
        ["Due", task.due_at ? formatDate(task.due_at) : null],
        ["Subdivision", task.job_number ? html`<a href="/subdivisions/${task.job_id}">${task.job_number}</a>` : null],
        ["Home", task.serial_number ? html`<a href="/homes/${task.home_id}">${task.serial_number}</a>` : null],
        ["Equipment", task.asset_tag ? html`<a href="/equipment/${task.asset_tag}">${task.asset_tag}</a>` : null],
        ["Photo required", task.requires_photo === 1 ? "Yes" : null],
        ["Completed", task.completed_at ? formatDate(task.completed_at) : null],
        ["Completion notes", task.completion_notes],
      ])}
      ${task.details ? html`<p>${task.details}</p>` : ""}
    </div>

    <h2>Evidence</h2>
    ${documentList(evidence)}
    ${uploadForm(ctx.actor, { workTaskId: task.id }, `/tasks/${task.id}`)}

    ${canWork && task.status !== "complete" && task.status !== "cancelled"
      ? html`
        <h2>Close this task</h2>
        <form class="card" method="post" action="/api/tasks/${task.id}/complete">
          <label for="notes">What did you do?</label>
          <textarea id="notes" name="notes" required></textarea>
          ${task.requires_photo === 1 && evidence.length === 0
            ? html`<p class="notice bad">A photo is required. Attach one above before closing.</p>`
            : ""}
          <div class="btn-row"><button type="submit">Mark complete</button></div>
        </form>

        <form class="card" method="post" action="/api/tasks/${task.id}/status">
          <label for="status">Or move it to</label>
          <select id="status" name="status">
            ${TASK_STATUSES.filter((value) => value !== "complete").map(
              (value) => html`<option value="${value}" ${raw(value === task.status ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
            )}
          </select>
          <div class="btn-row"><button class="secondary" type="submit">Update status</button></div>
        </form>`
      : ""}

    ${can(ctx.actor, "task.assign")
      ? html`<form class="card" method="post" action="/api/tasks/${task.id}/assign">
          <label for="assigned_to">Reassign</label>
          <select id="assigned_to" name="assigned_to">
            <option value="">Unassigned</option>
            ${employees.map((person) => html`<option value="${person.id}" ${raw(person.id === task.assigned_to ? "selected" : "")}>${person.display_name}</option>`)}
          </select>
          <div class="btn-row"><button class="secondary" type="submit">Reassign</button></div>
        </form>`
      : ""}
  `;

  return page(body, {
    title: "Task",
    actor: ctx.actor,
    section: "/tasks",
    back: { href: "/tasks", label: "Tasks" },
    flash: flashFrom(ctx.url),
  });
}

async function renderNewTask(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "task.assign");
  const employees = await listEmployees(ctx.db);
  const jobs = await listJobs(ctx.db, { status: "active" });
  const assets = await listAssets(ctx.db);
  const homes = await listHomes(ctx.db);
  const preset = {
    jobId: ctx.url.searchParams.get("jobId") ?? "",
    assetId: ctx.url.searchParams.get("assetId") ?? "",
    homeId: ctx.url.searchParams.get("homeId") ?? "",
  };

  const body = html`
    <h1>Assign a task</h1>
    <form method="post" action="/api/tasks">
      <label for="title">Task</label>
      <input id="title" name="title" required>
      <label for="details">Details</label>
      <textarea id="details" name="details"></textarea>
      <label for="assigned_to">Assign to</label>
      <select id="assigned_to" name="assigned_to">
        <option value="">Unassigned</option>
        ${employees.map((person) => html`<option value="${person.id}">${person.display_name} (${person.roles.join(", ")})</option>`)}
      </select>
      <label for="priority">Priority</label>
      <select id="priority" name="priority">
        ${TASK_PRIORITIES.map((value) => html`<option value="${value}" ${raw(value === "normal" ? "selected" : "")}>${value}</option>`)}
      </select>
      <label for="due_at">Due (YYYY-MM-DD or YYYY-MM-DD HH:MM)</label>
      <input id="due_at" name="due_at" placeholder="2026-08-30 17:00">
      <label for="job_id">Subdivision</label>
      <select id="job_id" name="job_id">
        <option value="">None</option>
        ${jobs.map((job) => html`<option value="${job.id}" ${raw(job.id === preset.jobId ? "selected" : "")}>${job.job_number} — ${job.title}</option>`)}
      </select>
      <label for="home_id">Home</label>
      <select id="home_id" name="home_id">
        <option value="">None</option>
        ${homes.map((home) => html`<option value="${home.id}" ${raw(home.id === preset.homeId ? "selected" : "")}>${home.serial_number}</option>`)}
      </select>
      <label for="asset_id">Equipment</label>
      <select id="asset_id" name="asset_id">
        <option value="">None</option>
        ${assets.map((asset) => html`<option value="${asset.id}" ${raw(asset.id === preset.assetId ? "selected" : "")}>${asset.asset_tag}</option>`)}
      </select>
      <label><input type="checkbox" name="requires_photo" value="on"> Require a photo before it can be closed</label>
      <div class="btn-row"><button type="submit">Assign</button></div>
    </form>
  `;
  return page(body, { title: "Assign a task", actor: ctx.actor, section: "/tasks", back: { href: "/tasks", label: "Tasks" } });
}

async function createTaskRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "task.assign");
  const fields = await readFields(ctx.request);
  const id = await createTask(ctx.db, ctx.actor, {
    title: requiredField(fields, "title", "Task"),
    details: optionalField(fields, "details"),
    priority: optionalField(fields, "priority") ?? "normal",
    dueAt: optionalField(fields, "due_at"),
    assignedTo: optionalField(fields, "assigned_to"),
    jobId: optionalField(fields, "job_id"),
    lotId: optionalField(fields, "lot_id"),
    homeId: optionalField(fields, "home_id"),
    assetId: optionalField(fields, "asset_id"),
    requiresPhoto: boolField(fields, "requires_photo"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/tasks/${id}?ok=task_created`);
}

async function setStatusRoute(ctx: RequestContext): Promise<Response> {
  const fields = await readFields(ctx.request);
  await setTaskStatus(ctx.db, ctx.actor, ctx.params.id, requiredField(fields, "status", "Status") as TaskStatus);
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/tasks/${ctx.params.id}?ok=saved`);
}

async function assignRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "task.assign");
  const fields = await readFields(ctx.request);
  await assignTask(ctx.db, ctx.actor, ctx.params.id, optionalField(fields, "assigned_to"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/tasks/${ctx.params.id}?ok=saved`);
}

async function completeRoute(ctx: RequestContext): Promise<Response> {
  const fields = await readFields(ctx.request);
  await completeTask(ctx.db, ctx.actor, { taskId: ctx.params.id, notes: optionalField(fields, "notes") });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/tasks/${ctx.params.id}?ok=task_completed`);
}
