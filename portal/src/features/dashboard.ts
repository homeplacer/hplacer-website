/** "Today" — the first screen a crew member sees on their phone. */
import { can } from "../auth/authz.ts";
import { fleetServiceDue, describeServiceDue } from "../domain/assets.ts";
import { openDefectCounts } from "../domain/defects.ts";
import { listParts } from "../domain/inventory.ts";
import { inbox, markRead, unreadCount } from "../domain/notifications.ts";
import { billingQueue, listRepairs } from "../domain/repairs.ts";
import { listTasks } from "../domain/tasks.ts";
import { warrantyReviewCount } from "../domain/warranty.ts";
import { badge, empty, formatDate, page, statGrid } from "../ui/layout.ts";
import { html } from "../ui/html.ts";
import type { RequestContext } from "../api/context.ts";
import { flashFrom, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";

export function registerDashboard(router: Router): void {
  router.get("/", async (ctx) => renderDashboard(ctx));
  router.get("/notifications", async (ctx) => renderNotifications(ctx));
  router.post("/api/notifications/:id/read", async (ctx) => {
    await markRead(ctx.db, ctx.actor.employeeId, ctx.params.id);
    return redirect("/notifications");
  });
}

async function renderDashboard(ctx: RequestContext): Promise<Response> {
  const { db, actor } = ctx;

  const myTasks = await listTasks(db, actor, { assignedTo: actor.employeeId, openOnly: true, limit: 6 });
  const myRepairs = await listRepairs(db, actor, { openOnly: true, limit: 5 });
  const defects = await openDefectCounts(db);
  const unread = await unreadCount(db, actor.employeeId);

  const serviceDue = can(actor, "asset.read") ? await fleetServiceDue(db) : [];
  const warrantyToReview = can(actor, "warranty.review") ? await warrantyReviewCount(db) : 0;
  const lowStock = can(actor, "inventory.read") ? await listParts(db, { lowOnly: true }) : [];
  const queue = can(actor, "repair.bill") ? await billingQueue(db, 5) : [];

  const body = html`
    <h1>Good day, ${actor.displayName.split(" ")[0]}</h1>
    <p class="lede">${describeRoles(ctx)}</p>

    ${statGrid([
      { n: myTasks.length, k: "My open tasks", href: "/tasks" },
      { n: myRepairs.length, k: "My open repairs", href: "/repairs" },
      { n: defects.critical + defects.major, k: "Open defects", href: "/defects" },
      { n: serviceDue.length, k: "Service due", href: "/equipment?filter=service" },
      ...(can(actor, "warranty.review") ? [{ n: warrantyToReview, k: "Warranty to review", href: "/warranty" }] : []),
    ])}

    <div class="btn-row">
      <a class="btn" href="/equipment">Start a pre-use inspection</a>
      <a class="btn secondary" href="/defects/new">Report a problem</a>
      <a class="btn secondary" href="/subdivisions">Subdivisions</a>
      <a class="btn secondary" href="/portable-john/new">Portable John</a>
      ${can(actor, "task.assign") ? html`<a class="btn secondary" href="/tasks/new">Assign a task</a>` : ""}
      ${can(actor, "warranty.review") ? html`<a class="btn secondary" href="/warranty">Warranty${warrantyToReview ? ` (${warrantyToReview})` : ""}</a>` : ""}
      ${can(actor, "repair.bill") ? html`<a class="btn secondary" href="/billing">Billing queue</a>` : ""}
    </div>

    ${warrantyToReview > 0
      ? html`<div class="notice bad" role="status">
          ${warrantyToReview} warranty request${warrantyToReview === 1 ? "" : "s"} could not be matched to a home.
          <a href="/warranty">Review ${warrantyToReview === 1 ? "it" : "them"}</a>.
        </div>`
      : ""}

    <h2>My tasks</h2>
    ${myTasks.length === 0
      ? empty("Nothing assigned to you right now.")
      : myTasks.map(
          (task) => html`<a class="card" href="/tasks/${task.id}">
            <div class="row"><h3>${task.title}</h3>${badge(task.priority, task.priority === "urgent" ? "bad" : task.priority === "high" ? "warn" : "")}</div>
            <div class="meta">${task.due_at ? `Due ${formatDate(task.due_at)}` : "No due date"}
              ${task.job_number ? ` · ${task.job_number}` : ""}${task.asset_tag ? ` · ${task.asset_tag}` : ""}</div>
          </a>`,
        )}

    ${serviceDue.length > 0
      ? html`<h2>Equipment service</h2>
          ${serviceDue.slice(0, 5).map(
            (item) => html`<a class="card" href="/equipment/${item.asset_tag}">
              <div class="row"><h3>${item.asset_tag} — ${item.description}</h3>${badge(item.overdue ? "overdue" : "due soon", item.overdue ? "bad" : "warn")}</div>
              <div class="meta">${describeServiceDue(item)}</div>
            </a>`,
          )}`
      : ""}

    ${lowStock.length > 0
      ? html`<h2>Low stock</h2>
          ${lowStock.slice(0, 5).map(
            (part) => html`<a class="card" href="/inventory/${part.id}">
              <div class="row"><h3>${part.sku} — ${part.name}</h3>${badge(`${part.quantity_on_hand} ${part.unit}`, "warn")}</div>
              <div class="meta">Reorder at ${part.reorder_point}${part.preferred_vendor ? ` · ${part.preferred_vendor}` : ""}</div>
            </a>`,
          )}`
      : ""}

    ${queue.length > 0
      ? html`<h2>Bill-back queue</h2>
          ${queue.map(
            (ticket) => html`<a class="card" href="/repairs/${ticket.id}">
              <div class="row"><h3>${ticket.ticket_number} — ${ticket.title}</h3>${badge(ticket.bill_back_status, ticket.bill_back_status === "ready_to_bill" ? "warn" : "")}</div>
              <div class="meta">${ticket.serial_number ?? ticket.asset_tag ?? ""} · ${ticket.responsible_party ?? "responsible party not set"}</div>
            </a>`,
          )}`
      : ""}
  `;

  return page(body, {
    title: "Today",
    actor,
    section: "/",
    unread,
    flash: flashFrom(ctx.url),
  });
}

function describeRoles(ctx: RequestContext): string {
  const { actor } = ctx;
  if (can(actor, "employee.manage")) return "Administrator — full access, including employee and Monday setup.";
  if (can(actor, "repair.bill") && can(actor, "task.assign")) return "Supervisor and billing — field work plus the bill-back queue.";
  if (can(actor, "repair.bill")) return "Billing — repair bill-backs, purchasing, and stock.";
  if (can(actor, "task.assign")) return "Supervisor — assign work, approve repairs, manage equipment.";
  return "Field crew — inspections, tasks, repairs, and material requests.";
}

async function renderNotifications(ctx: RequestContext): Promise<Response> {
  const items = await inbox(ctx.db, ctx.actor.employeeId);
  const body = html`
    <h1>Notifications</h1>
    ${items.length === 0
      ? empty("Nothing here yet.")
      : items.map(
          (item) => html`<div class="card">
            <div class="row">
              <h3>${item.title}</h3>
              ${badge(item.severity, item.severity === "urgent" ? "bad" : item.severity === "warning" ? "warn" : "")}
            </div>
            <p class="meta">${formatDate(item.created_at)} · ${item.category.replace(/_/g, " ")}</p>
            <p>${item.body}</p>
            <div class="btn-row">
              ${item.related_type && item.related_id ? html`<a class="btn secondary" href="${linkFor(item.related_type, item.related_id)}">Open</a>` : ""}
              ${item.read_at
                ? ""
                : html`<form method="post" action="/api/notifications/${item.id}/read"><button class="secondary" type="submit">Mark read</button></form>`}
            </div>
          </div>`,
        )}
  `;
  return page(body, { title: "Notifications", actor: ctx.actor, section: "/notifications", back: { href: "/", label: "Today" } });
}

function linkFor(type: string, id: string): string {
  switch (type) {
    case "repair_ticket":
      return `/repairs/${id}`;
    case "work_task":
      return `/tasks/${id}`;
    case "inspection":
      return `/inspections/${id}`;
    case "asset":
      return `/equipment/${id}`;
    case "part":
      return `/inventory/${id}`;
    case "warranty_request":
      return `/warranty/${id}`;
    case "portable_john_request":
      return `/portable-john/${id}`;
    case "defect":
      return `/defects`;
    case "material_request":
      return `/inventory/requests`;
    default:
      return "/";
  }
}
