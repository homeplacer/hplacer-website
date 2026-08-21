/** Administration: staff and roles, the Monday link registry, and the audit log. */
import { ROLES, assertCan, isRole, type Role } from "../auth/authz.ts";
import { recentAudit } from "../domain/audit.ts";
import { createEmployee, grantRole, listEmployees, revokeRole, setEmployeeActive } from "../domain/employees.ts";
import { notifyServiceDue } from "../domain/assets.ts";
import { addRoute, listRouting, recipientsFor, removeRoute, type NotificationCategory } from "../domain/notifications.ts";
import { pendingMondayRuns } from "../integrations/monday.ts";
import { sweepLowStock } from "../domain/inventory.ts";
import {
  MONDAY_BOARD_KEYS,
  MONDAY_ENTITY_TYPES,
  detachEntity,
  linkEntity,
  linkOverview,
  listBoards,
  pendingSyncQueue,
  upsertBoard,
  type CanonicalKeyKind,
  type MondayBoardKey,
  type MondayEntityType,
} from "../integrations/monday.ts";
import { badRequest } from "../platform/errors.ts";
import { boolField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html } from "../ui/html.ts";
import { badge, empty, formatDate, page, tabs } from "../ui/layout.ts";
import { wantsJson } from "./equipment.ts";

const KEY_KINDS: CanonicalKeyKind[] = ["serial_number", "vin", "asset_tag", "job_number", "ticket_number"];

export function registerAdmin(router: Router): void {
  router.get("/admin", renderEmployees);
  router.get("/admin/notifications", renderNotificationRouting);
  router.get("/admin/monday", renderMonday);
  router.get("/admin/audit", renderAudit);

  router.post("/api/notification-routes", addRouteRoute);
  router.post("/api/notification-routes/:id/delete", removeRouteRoute);
  router.delete("/api/notification-routes/:id", removeRouteRoute);
  router.get("/api/notification-routes", async (ctx) => {
    assertCan(ctx.actor, "notification.route.manage");
    return json({ routing: await listRouting(ctx.db) });
  });

  router.post("/api/employees", createEmployeeRoute);
  router.post("/api/employees/:id/roles", rolesRoute);
  router.post("/api/employees/:id/active", activeRoute);
  router.post("/api/monday/boards", upsertBoardRoute);
  router.post("/api/monday/links", linkRoute);
  router.post("/api/monday/links/:type/:id/detach", detachRoute);
  router.post("/api/maintenance/sweeps", sweepRoute);

  router.get("/api/employees", async (ctx) => {
    assertCan(ctx.actor, "employee.manage");
    return json({ employees: await listEmployees(ctx.db, true) });
  });
  router.get("/api/monday/links", async (ctx) => {
    assertCan(ctx.actor, "monday.manage");
    return json({ boards: await listBoards(ctx.db), links: await linkOverview(ctx.db), queue: await pendingSyncQueue(ctx.db) });
  });
}

function adminTabs(current: string) {
  return tabs([
    { href: "/admin", label: "Staff", current: current === "staff" },
    { href: "/admin/notifications", label: "Notifications", current: current === "notifications" },
    { href: "/admin/monday", label: "Monday", current: current === "monday" },
    { href: "/admin/audit", label: "Audit log", current: current === "audit" },
  ]);
}

async function renderNotificationRouting(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "notification.route.manage");
  const routing = await listRouting(ctx.db);
  const employees = await listEmployees(ctx.db);

  // Show who each category would actually reach right now, defaults included.
  const resolved = new Map<string, string[]>();
  for (const category of routing) {
    const ids = await recipientsFor(ctx.db, category.category as NotificationCategory);
    resolved.set(
      category.category,
      ids.map((id) => employees.find((person) => person.id === id)?.display_name ?? id),
    );
  }

  const body = html`
    <h1>Notifications</h1>
    ${adminTabs("notifications")}
    <p class="lede">Who hears about what. A category with no recipients configured falls back to its
      default role, so nothing ever goes nowhere.</p>

    ${routing.map(
      (category) => html`<div class="card">
        <div class="row"><h3>${category.label}</h3>
          ${category.using_default ? badge(`default: ${category.default_role}`, "warn") : badge("configured", "ok")}</div>
        ${category.description ? html`<p class="meta">${category.description}</p>` : ""}
        <p class="meta">Reaches now: ${(resolved.get(category.category) ?? []).join(", ") || "nobody — check that the role has active staff"}</p>

        ${category.routes.length > 0
          ? html`<div class="table-wrap"><table>
              <thead><tr><th>Recipient</th><th>Kind</th><th></th></tr></thead>
              <tbody>${category.routes.map(
                (route) => html`<tr>
                  <td>${route.recipient_kind === "role" ? route.recipient_role : route.recipient_name ?? route.recipient_employee_id}</td>
                  <td>${route.recipient_kind}</td>
                  <td><form method="post" action="/api/notification-routes/${route.id}/delete">
                    <button class="secondary" type="submit">Remove</button></form></td>
                </tr>`,
              )}</tbody></table></div>`
          : ""}

        <form method="post" action="/api/notification-routes">
          <input type="hidden" name="category" value="${category.category}">
          <label for="role-${category.category}">Add a role</label>
          <select id="role-${category.category}" name="recipient_role">
            <option value="">—</option>
            ${ROLES.map((role) => html`<option value="${role}">${role}</option>`)}
          </select>
          <label for="person-${category.category}">…or one person</label>
          <select id="person-${category.category}" name="recipient_employee_id">
            <option value="">—</option>
            ${employees.map((person) => html`<option value="${person.id}">${person.display_name}</option>`)}
          </select>
          <div class="btn-row"><button class="secondary" type="submit">Add recipient</button></div>
        </form>
      </div>`,
    )}
  `;
  return page(body, {
    title: "Notifications",
    actor: ctx.actor,
    section: "/admin",
    back: { href: "/admin", label: "Admin" },
    flash: flashFrom(ctx.url),
  });
}

async function addRouteRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "notification.route.manage");
  const fields = await readFields(ctx.request);
  const role = optionalField(fields, "recipient_role");
  const employeeId = optionalField(fields, "recipient_employee_id");
  if (role && employeeId) throw badRequest("Add a role or a person, not both at once");
  if (!role && !employeeId) throw badRequest("Choose a role or a person");
  if (role && !isRole(role)) throw badRequest("Unknown role");

  const id = await addRoute(ctx.db, {
    category: requiredField(fields, "category", "Category"),
    recipientKind: role ? "role" : "employee",
    recipientRole: role ? (role as Role) : null,
    recipientEmployeeId: employeeId,
    createdBy: ctx.actor.employeeId,
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect("/admin/notifications?ok=saved");
}

async function removeRouteRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "notification.route.manage");
  await removeRoute(ctx.db, ctx.params.id);
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/admin/notifications?ok=saved");
}

async function renderEmployees(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "employee.manage");
  const employees = await listEmployees(ctx.db, true);

  const body = html`
    <h1>Staff</h1>
    ${adminTabs("staff")}
    <p class="lede">Passing the Cloudflare Access policy proves who someone is. It does not grant portal access —
      an employee record has to exist here first, and the role on it is what the server enforces.</p>

    ${employees.map(
      (person) => html`<div class="card">
        <div class="row"><h3>${person.display_name}</h3>${badge(person.active ? "active" : "inactive", person.active ? "ok" : "bad")}</div>
        <div class="meta">${person.email}${person.crew ? ` · ${person.crew}` : ""} · last seen ${formatDate(person.last_seen_at)}</div>
        <p>${person.roles.map((role) => badge(role, role === "admin" ? "warn" : ""))}</p>
        <form method="post" action="/api/employees/${person.id}/roles">
          <label for="role-${person.id}">Add or remove a role</label>
          <select id="role-${person.id}" name="role">
            ${ROLES.map((role) => html`<option value="${role}">${role}</option>`)}
          </select>
          <label><input type="checkbox" name="revoke" value="on"> Remove instead of adding</label>
          <div class="btn-row"><button class="secondary" type="submit">Apply</button></div>
        </form>
        <form method="post" action="/api/employees/${person.id}/active">
          <input type="hidden" name="active" value="${person.active ? "0" : "1"}">
          <div class="btn-row"><button class="${person.active ? "danger" : "secondary"}" type="submit">
            ${person.active ? "Deactivate" : "Reactivate"}</button></div>
        </form>
      </div>`,
    )}

    <h2>Add an employee</h2>
    <form class="card" method="post" action="/api/employees">
      <label for="email">Work email (must match their Cloudflare Access identity)</label>
      <input id="email" name="email" type="email" required>
      <label for="display_name">Name</label>
      <input id="display_name" name="display_name" required>
      <label for="role">Primary role</label>
      <select id="role" name="role">${ROLES.map((role) => html`<option value="${role}">${role}</option>`)}</select>
      <label for="extra_role">Additional role (optional)</label>
      <select id="extra_role" name="extra_role">
        <option value="">None</option>
        ${ROLES.map((role) => html`<option value="${role}">${role}</option>`)}
      </select>
      <label for="crew">Crew</label>
      <input id="crew" name="crew">
      <div class="btn-row"><button type="submit">Add employee</button></div>
    </form>

    <h2>Maintenance sweeps</h2>
    <form class="card" method="post" action="/api/maintenance/sweeps">
      <p class="meta">Runs the low-stock and service-due checks and files any notifications that are missing.
        A scheduled Worker trigger would normally do this each morning.</p>
      <div class="btn-row"><button class="secondary" type="submit">Run sweeps now</button></div>
    </form>
  `;
  return page(body, { title: "Staff", actor: ctx.actor, section: "/admin", back: { href: "/", label: "Today" }, flash: flashFrom(ctx.url) });
}

async function renderMonday(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "monday.manage");
  const boards = await listBoards(ctx.db);
  const links = await linkOverview(ctx.db);
  const queue = await pendingSyncQueue(ctx.db, 25);

  const body = html`
    <h1>Monday.com links</h1>
    ${adminTabs("monday")}
    <div class="notice">
      This portal does not call Monday. It records which serial number, VIN, job number, or ticket number
      corresponds to which Monday item id, and queues the changes a future sync worker would push.
      No Monday API token is stored or required.
    </div>

    <h2>Boards</h2>
    ${boards.length === 0 ? empty("No boards configured.") : ""}
    ${boards.map(
      (board) => html`<div class="card">
        <div class="row"><h3>${board.name}</h3>${badge(board.board_key)}</div>
        <div class="meta">Board ${board.monday_board_id} · keyed on ${board.canonical_key_kind.replace(/_/g, " ")}</div>
      </div>`,
    )}

    <form class="card" method="post" action="/api/monday/boards">
      <label for="board_key">Board</label>
      <select id="board_key" name="board_key">${MONDAY_BOARD_KEYS.map((value) => html`<option value="${value}">${value}</option>`)}</select>
      <label for="monday_board_id">Monday board id</label>
      <input id="monday_board_id" name="monday_board_id" inputmode="numeric" required>
      <label for="name">Label</label>
      <input id="name" name="name" required>
      <label for="canonical_key_kind">Keyed on</label>
      <select id="canonical_key_kind" name="canonical_key_kind">
        ${KEY_KINDS.map((value) => html`<option value="${value}">${value.replace(/_/g, " ")}</option>`)}
      </select>
      <div class="btn-row"><button type="submit">Save board</button></div>
    </form>

    <h2>Links</h2>
    ${links.length === 0
      ? empty("Nothing linked yet.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>Record</th><th>Canonical key</th><th>Item</th><th>State</th><th></th></tr></thead>
          <tbody>${links.map(
            (link) => html`<tr>
              <td>${link.entity_type.replace(/_/g, " ")}<br><span class="meta">${link.label}</span></td>
              <td>${link.canonical_key}</td>
              <td>${link.monday_item_id}</td>
              <td>${badge(link.sync_state, link.sync_state === "linked" ? "ok" : link.sync_state === "conflict" ? "bad" : "warn")}</td>
              <td>${link.sync_state === "detached"
                ? ""
                : html`<form method="post" action="/api/monday/links/${link.entity_type}/${link.entity_id}/detach">
                    <button class="secondary" type="submit">Detach</button></form>`}</td>
            </tr>`,
          )}</tbody></table></div>`}

    <form class="card" method="post" action="/api/monday/links">
      <label for="entity_type">Record type</label>
      <select id="entity_type" name="entity_type">${MONDAY_ENTITY_TYPES.map((value) => html`<option value="${value}">${value.replace(/_/g, " ")}</option>`)}</select>
      <label for="entity_id">Portal record id</label>
      <input id="entity_id" name="entity_id" required>
      <label for="link_board_key">Board</label>
      <select id="link_board_key" name="board_key">${MONDAY_BOARD_KEYS.map((value) => html`<option value="${value}">${value}</option>`)}</select>
      <label for="monday_item_id">Monday item id</label>
      <input id="monday_item_id" name="monday_item_id" inputmode="numeric" required>
      <div class="btn-row"><button type="submit">Record link</button></div>
    </form>

    <h2>Discovery runs</h2>
    ${await mondayRunsTable(ctx)}

    <h2>Queued changes</h2>
    ${queue.length === 0
      ? empty("Nothing queued.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Operation</th><th>Record</th><th>Key</th><th>Status</th></tr></thead>
          <tbody>${queue.map(
            (item) => html`<tr>
              <td>${formatDate(item.created_at)}</td><td>${item.operation}</td>
              <td>${item.entity_type.replace(/_/g, " ")}</td><td>${item.canonical_key}</td>
              <td>${badge(item.status, item.status === "sent" ? "ok" : item.status === "failed" ? "bad" : "warn")}</td>
            </tr>`,
          )}</tbody></table></div>`}
  `;
  return page(body, { title: "Monday links", actor: ctx.actor, section: "/admin", back: { href: "/admin", label: "Admin" }, flash: flashFrom(ctx.url) });
}

async function renderAudit(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "audit.read");
  const entries = await recentAudit(ctx.db, 200);
  const body = html`
    <h1>Audit log</h1>
    ${adminTabs("audit")}
    <p class="lede">Every write and every refused request, in order.</p>
    ${entries.length === 0
      ? empty("Nothing logged yet.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Outcome</th></tr></thead>
          <tbody>${entries.map(
            (entry) => html`<tr>
              <td>${formatDate(entry.created_at)}</td>
              <td>${entry.actor_email ?? "—"}</td>
              <td>${entry.action}${entry.detail ? html`<br><span class="meta">${entry.detail}</span>` : ""}</td>
              <td>${entry.entity_type}${entry.entity_id ? html`<br><span class="meta">${entry.entity_id}</span>` : ""}</td>
              <td>${badge(entry.outcome, entry.outcome === "allowed" ? "ok" : "bad")}</td>
            </tr>`,
          )}</tbody></table></div>`}
  `;
  return page(body, { title: "Audit log", actor: ctx.actor, section: "/admin", back: { href: "/admin", label: "Admin" } });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createEmployeeRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "employee.manage");
  const fields = await readFields(ctx.request);
  const role = requiredField(fields, "role", "Role");
  if (!isRole(role)) throw badRequest("Unknown role");
  const extra = optionalField(fields, "extra_role");
  const id = await createEmployee(ctx.db, {
    email: requiredField(fields, "email", "Email"),
    displayName: requiredField(fields, "display_name", "Name"),
    role,
    crew: optionalField(fields, "crew"),
    phone: optionalField(fields, "phone"),
    extraRoles: extra && isRole(extra) ? [extra] : [],
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect("/admin?ok=employee_added");
}

async function rolesRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "employee.manage");
  const fields = await readFields(ctx.request);
  const role = requiredField(fields, "role", "Role");
  if (!isRole(role)) throw badRequest("Unknown role");
  if (boolField(fields, "revoke")) {
    await revokeRole(ctx.db, ctx.params.id, role as Role);
  } else {
    await grantRole(ctx.db, ctx.params.id, role as Role, ctx.actor.employeeId);
  }
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/admin?ok=saved");
}

async function activeRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "employee.manage");
  const fields = await readFields(ctx.request);
  if (ctx.params.id === ctx.actor.employeeId) throw badRequest("You cannot deactivate your own account");
  await setEmployeeActive(ctx.db, ctx.params.id, fields.active === "1");
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/admin?ok=saved");
}

async function upsertBoardRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "monday.manage");
  const fields = await readFields(ctx.request);
  await upsertBoard(ctx.db, {
    boardKey: requiredField(fields, "board_key", "Board") as MondayBoardKey,
    mondayBoardId: requiredField(fields, "monday_board_id", "Board id"),
    name: requiredField(fields, "name", "Label"),
    canonicalKeyKind: requiredField(fields, "canonical_key_kind", "Key kind") as CanonicalKeyKind,
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/admin/monday?ok=saved");
}

async function linkRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "monday.manage");
  const fields = await readFields(ctx.request);
  const id = await linkEntity(ctx.db, ctx.monday, {
    entityType: requiredField(fields, "entity_type", "Record type") as MondayEntityType,
    entityId: requiredField(fields, "entity_id", "Record id"),
    boardKey: requiredField(fields, "board_key", "Board") as MondayBoardKey,
    mondayItemId: requiredField(fields, "monday_item_id", "Item id"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect("/admin/monday?ok=linked");
}

async function detachRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "monday.manage");
  await detachEntity(ctx.db, ctx.monday, ctx.params.type as MondayEntityType, ctx.params.id);
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/admin/monday?ok=unlinked");
}

async function sweepRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "employee.manage");
  const lowStock = await sweepLowStock(ctx.db);
  const serviceDue = await notifyServiceDue(ctx.db);
  return wantsJson(ctx) ? json({ lowStock, serviceDue }) : redirect("/admin?ok=swept");
}

async function mondayRunsTable(ctx: RequestContext) {
  const runs = await pendingMondayRuns(ctx.db, 10);
  if (runs.length === 0) {
    return html`<p class="empty">No discovery runs yet. Run
      <code>node portal/ops/monday-discover.ts --board homes</code> from a machine that holds the token.</p>`;
  }
  return html`<div class="table-wrap"><table>
    <thead><tr><th>When</th><th>Board</th><th>Mode</th><th>Items</th><th>Ready</th><th>Ambiguous</th><th>Unmatched</th><th>Conflicts</th><th>Links written</th></tr></thead>
    <tbody>${runs.map(
      (run) => html`<tr>
        <td>${formatDate(run.started_at)}</td>
        <td>${run.board_key}</td>
        <td>${run.mode.replace(/_/g, " ")}</td>
        <td>${run.items_seen}</td>
        <td>${run.matched}</td>
        <td>${run.ambiguous}</td>
        <td>${run.unmatched}</td>
        <td>${run.conflicts}</td>
        <td>${run.links_written}</td>
      </tr>`,
    )}</tbody></table></div>`;
}
