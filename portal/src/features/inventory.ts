/** Parts, stock levels, vendor links, and material requests. */
import { assertCan, can } from "../auth/authz.ts";
import {
  MOVEMENT_TYPES,
  advanceMaterialRequest,
  createMaterialRequest,
  createPart,
  listMaterialRequests,
  listMovements,
  listParts,
  recordMovement,
  requirePart,
  updatePart,
  type REQUEST_STATUSES,
} from "../domain/inventory.ts";
import { centsField, numberField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect, safeRedirectPath } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, raw } from "../ui/html.ts";
import { badge, empty, externalLink, formatDate, kv, money, page, tabs } from "../ui/layout.ts";
import { wantsJson } from "./equipment.ts";

export function registerInventory(router: Router): void {
  router.get("/inventory", renderList);
  router.get("/inventory/requests", renderRequests);
  router.get("/inventory/new", renderNewPart);
  router.get("/inventory/:id", renderPart);

  router.post("/api/inventory/parts", createPartRoute);
  router.post("/api/inventory/parts/:id", updatePartRoute);
  router.post("/api/inventory/parts/:id/movements", movementRoute);
  router.post("/api/inventory/requests", createRequestRoute);
  router.post("/api/inventory/requests/:id/status", advanceRequestRoute);

  router.get("/api/inventory/parts", async (ctx) => {
    assertCan(ctx.actor, "inventory.read");
    return json({ parts: await listParts(ctx.db, { lowOnly: ctx.url.searchParams.get("low") === "1" }) });
  });
}

async function renderList(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.read");
  const lowOnly = ctx.url.searchParams.get("low") === "1";
  const search = ctx.url.searchParams.get("q") ?? undefined;
  const parts = await listParts(ctx.db, { lowOnly, search });

  const body = html`
    <h1>Inventory</h1>
    <form method="get" action="/inventory">
      <label for="q">Search SKU, name, or vendor</label>
      <input id="q" name="q" value="${search ?? ""}" inputmode="search" autocomplete="off">
      <div class="btn-row"><button type="submit">Search</button></div>
    </form>

    ${tabs([
      { href: "/inventory", label: "All parts", current: !lowOnly },
      { href: "/inventory?low=1", label: "Low stock", current: lowOnly },
      { href: "/inventory/requests", label: "Requests" },
    ])}

    ${parts.length === 0
      ? empty("Nothing here.")
      : parts.map(
          (part) => html`<a class="card" href="/inventory/${part.id}">
            <div class="row"><h3>${part.sku} — ${part.name}</h3>
              ${badge(`${part.quantity_on_hand} ${part.unit}`, part.low_stock ? "bad" : "ok")}</div>
            <div class="meta">Reorder at ${part.reorder_point}${part.reorder_quantity ? `, order ${part.reorder_quantity}` : ""}
              ${part.preferred_vendor ? ` · ${part.preferred_vendor}` : ""}
              ${part.preferred_unit_cost_cents ? ` · ${money(part.preferred_unit_cost_cents)}` : ""}
              ${part.open_request_count > 0 ? ` · ${part.open_request_count} on request` : ""}</div>
          </a>`,
        )}

    ${can(ctx.actor, "inventory.manage") ? html`<div class="btn-row"><a class="btn secondary" href="/inventory/new">Add a part</a></div>` : ""}
  `;
  return page(body, { title: "Inventory", actor: ctx.actor, section: "/inventory", flash: flashFrom(ctx.url) });
}

async function renderPart(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.read");
  const part = await requirePart(ctx.db, ctx.params.id);
  const movements = await listMovements(ctx.db, part.id);
  const low = part.quantity_on_hand <= part.reorder_point;

  const body = html`
    <h1>${part.sku}</h1>
    <p class="lede">${part.name}</p>

    <div class="card">
      <div class="row">${badge(`${part.quantity_on_hand} ${part.unit} on hand`, low ? "bad" : "ok")}</div>
      ${kv([
        ["Description", part.description],
        ["Reorder point", part.reorder_point],
        ["Reorder quantity", part.reorder_quantity],
        ["Preferred vendor", part.preferred_vendor],
        ["Vendor link", externalLink(part.product_url, "Open vendor page")],
        ["Preferred cost", money(part.preferred_unit_cost_cents)],
        ["Location", part.storage_location],
      ])}
      <div class="btn-row">
        <a class="btn secondary" href="/inventory/requests?partId=${part.id}">Request more</a>
      </div>
    </div>

    ${can(ctx.actor, "inventory.adjust")
      ? html`<details class="card" ${raw(low ? "open" : "")}>
          <summary><strong>Record a stock movement</strong></summary>
          <form method="post" action="/api/inventory/parts/${part.id}/movements">
            <label for="movement_type">Movement</label>
            <select id="movement_type" name="movement_type">
              ${MOVEMENT_TYPES.map((value) => html`<option value="${value}">${value}</option>`)}
            </select>
            <label for="quantity">Quantity (positive; "used" removes it)</label>
            <input id="quantity" name="quantity" inputmode="decimal" required>
            <label for="notes">Notes</label>
            <input id="notes" name="notes">
            <div class="btn-row"><button type="submit">Record</button></div>
          </form>
        </details>`
      : ""}

    ${can(ctx.actor, "inventory.manage")
      ? html`<details class="card">
          <summary><strong>Edit part</strong></summary>
          <form method="post" action="/api/inventory/parts/${part.id}">
            <label for="name">Name</label>
            <input id="name" name="name" value="${part.name}">
            <label for="reorder_point">Reorder point</label>
            <input id="reorder_point" name="reorder_point" inputmode="decimal" value="${part.reorder_point}">
            <label for="reorder_quantity">Reorder quantity</label>
            <input id="reorder_quantity" name="reorder_quantity" inputmode="decimal" value="${part.reorder_quantity}">
            <label for="preferred_vendor">Preferred vendor</label>
            <input id="preferred_vendor" name="preferred_vendor" value="${part.preferred_vendor ?? ""}">
            <label for="product_url">Vendor product URL</label>
            <input id="product_url" name="product_url" inputmode="url" value="${part.product_url ?? ""}">
            <label for="unit_cost">Preferred unit cost (USD)</label>
            <input id="unit_cost" name="unit_cost" inputmode="decimal"
                   value="${part.preferred_unit_cost_cents != null ? (part.preferred_unit_cost_cents / 100).toFixed(2) : ""}">
            <label for="storage_location">Location</label>
            <input id="storage_location" name="storage_location" value="${part.storage_location ?? ""}">
            <div class="btn-row"><button type="submit">Save</button></div>
          </form>
        </details>`
      : ""}

    <h2>Movement history</h2>
    ${movements.length === 0
      ? empty("No movements recorded.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Type</th><th>Qty</th><th>Who</th><th>Notes</th></tr></thead>
          <tbody>${movements.map(
            (movement) => html`<tr>
              <td>${formatDate(movement.created_at)}</td>
              <td>${movement.movement_type}</td>
              <td>${movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}</td>
              <td>${movement.recorded_by_name}</td>
              <td>${movement.ticket_number ? html`<a href="/repairs/${movement.ticket_number}">${movement.ticket_number}</a> ` : ""}${movement.notes ?? ""}</td>
            </tr>`,
          )}</tbody></table></div>`}
  `;
  return page(body, {
    title: part.sku,
    actor: ctx.actor,
    section: "/inventory",
    back: { href: "/inventory", label: "Inventory" },
    flash: flashFrom(ctx.url),
  });
}

async function renderRequests(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.read");
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const requests = await listMaterialRequests(ctx.db, { status });
  const parts = await listParts(ctx.db);
  const presetPart = ctx.url.searchParams.get("partId") ?? "";
  const statuses: (typeof REQUEST_STATUSES)[number][] = ["requested", "approved", "ordered", "received", "cancelled"];

  const body = html`
    <h1>Material requests</h1>
    ${tabs([
      { href: "/inventory/requests", label: "All", current: !status },
      ...statuses.map((value) => ({ href: `/inventory/requests?status=${value}`, label: value, current: status === value })),
    ])}

    ${requests.length === 0
      ? empty("No requests.")
      : requests.map(
          (request) => html`<div class="card">
            <div class="row"><h3>${request.description}</h3>${badge(request.status, request.status === "received" ? "ok" : "warn")}</div>
            <div class="meta">${request.requested_quantity} × ${request.sku ?? "unstocked"} · ${request.requested_by_name} ·
              ${formatDate(request.created_at)}${request.needed_by ? ` · needed by ${request.needed_by}` : ""}
              ${request.ticket_number ? html` · <a href="/repairs/${request.repair_ticket_id}">${request.ticket_number}</a>` : ""}</div>
            ${request.supplier_name || request.supplier_url
              ? html`<p class="meta">${request.supplier_name ?? ""} ${externalLink(request.supplier_url, "Vendor page")}</p>`
              : ""}
            ${can(ctx.actor, "material_request.approve") && request.status !== "received" && request.status !== "cancelled"
              ? html`<form method="post" action="/api/inventory/requests/${request.id}/status">
                  <label for="status-${request.id}">Move to</label>
                  <select id="status-${request.id}" name="status">
                    ${statuses.map((value) => html`<option value="${value}">${value}</option>`)}
                  </select>
                  <label for="received-${request.id}">Received quantity (if different)</label>
                  <input id="received-${request.id}" name="received_quantity" inputmode="decimal">
                  <div class="btn-row"><button class="secondary" type="submit">Update</button></div>
                </form>`
              : ""}
          </div>`,
        )}

    <h2>New request</h2>
    <form class="card" method="post" action="/api/inventory/requests">
      <input type="hidden" name="redirect_to" value="/inventory/requests">
      <label for="part_id">Stocked part</label>
      <select id="part_id" name="part_id">
        <option value="">Not a stocked part</option>
        ${parts.map((part) => html`<option value="${part.id}" ${raw(part.id === presetPart ? "selected" : "")}>${part.sku} — ${part.name}</option>`)}
      </select>
      <label for="description">What do you need?</label>
      <input id="description" name="description" required>
      <label for="quantity">How many</label>
      <input id="quantity" name="quantity" inputmode="decimal" required>
      <label for="supplier_name">Supplier</label>
      <input id="supplier_name" name="supplier_name">
      <label for="supplier_url">Supplier link</label>
      <input id="supplier_url" name="supplier_url" inputmode="url">
      <label for="needed_by">Needed by</label>
      <input id="needed_by" name="needed_by" placeholder="2026-08-27">
      <div class="btn-row"><button type="submit">Send request</button></div>
    </form>
  `;
  return page(body, {
    title: "Material requests",
    actor: ctx.actor,
    section: "/inventory",
    back: { href: "/inventory", label: "Inventory" },
    flash: flashFrom(ctx.url),
  });
}

async function renderNewPart(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.manage");
  const body = html`
    <h1>Add a part</h1>
    <form method="post" action="/api/inventory/parts">
      <label for="sku">SKU</label>
      <input id="sku" name="sku" required autocapitalize="characters">
      <label for="name">Name</label>
      <input id="name" name="name" required>
      <label for="description">Description</label>
      <textarea id="description" name="description"></textarea>
      <label for="unit">Unit</label>
      <input id="unit" name="unit" value="each">
      <label for="opening_quantity">Opening quantity</label>
      <input id="opening_quantity" name="opening_quantity" inputmode="decimal" value="0">
      <label for="reorder_point">Reorder point</label>
      <input id="reorder_point" name="reorder_point" inputmode="decimal" value="0">
      <label for="reorder_quantity">Reorder quantity</label>
      <input id="reorder_quantity" name="reorder_quantity" inputmode="decimal" value="0">
      <label for="preferred_vendor">Preferred vendor</label>
      <input id="preferred_vendor" name="preferred_vendor">
      <label for="product_url">Vendor product URL</label>
      <input id="product_url" name="product_url" inputmode="url">
      <label for="unit_cost">Preferred unit cost (USD)</label>
      <input id="unit_cost" name="unit_cost" inputmode="decimal">
      <label for="storage_location">Location</label>
      <input id="storage_location" name="storage_location">
      <div class="btn-row"><button type="submit">Add part</button></div>
    </form>
  `;
  return page(body, { title: "Add a part", actor: ctx.actor, section: "/inventory", back: { href: "/inventory", label: "Inventory" } });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createPartRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.manage");
  const fields = await readFields(ctx.request);
  const id = await createPart(ctx.db, {
    sku: requiredField(fields, "sku", "SKU"),
    name: requiredField(fields, "name", "Name"),
    description: optionalField(fields, "description"),
    unit: optionalField(fields, "unit") ?? "each",
    reorderPoint: numberField(fields, "reorder_point", "Reorder point") ?? 0,
    reorderQuantity: numberField(fields, "reorder_quantity", "Reorder quantity") ?? 0,
    preferredVendor: optionalField(fields, "preferred_vendor"),
    productUrl: optionalField(fields, "product_url"),
    preferredUnitCostCents: centsField(fields, "unit_cost", "Unit cost"),
    storageLocation: optionalField(fields, "storage_location"),
    openingQuantity: numberField(fields, "opening_quantity", "Opening quantity") ?? 0,
    recordedBy: ctx.actor.employeeId,
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/inventory/${id}?ok=saved`);
}

async function updatePartRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.manage");
  const fields = await readFields(ctx.request);
  await updatePart(ctx.db, {
    partId: ctx.params.id,
    name: optionalField(fields, "name") ?? undefined,
    reorderPoint: numberField(fields, "reorder_point", "Reorder point") ?? undefined,
    reorderQuantity: numberField(fields, "reorder_quantity", "Reorder quantity") ?? undefined,
    preferredVendor: optionalField(fields, "preferred_vendor"),
    productUrl: optionalField(fields, "product_url"),
    preferredUnitCostCents: centsField(fields, "unit_cost", "Unit cost"),
    storageLocation: optionalField(fields, "storage_location"),
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/inventory/${ctx.params.id}?ok=saved`);
}

async function movementRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inventory.adjust");
  const fields = await readFields(ctx.request);
  const id = await recordMovement(ctx.db, {
    partId: ctx.params.id,
    movementType: requiredField(fields, "movement_type", "Movement") as (typeof MOVEMENT_TYPES)[number],
    quantity: numberField(fields, "quantity", "Quantity") ?? 0,
    recordedBy: ctx.actor.employeeId,
    notes: optionalField(fields, "notes"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/inventory/${ctx.params.id}?ok=saved`);
}

async function createRequestRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "material_request.create");
  const fields = await readFields(ctx.request);
  const id = await createMaterialRequest(ctx.db, ctx.actor, {
    partId: optionalField(fields, "part_id"),
    repairTicketId: optionalField(fields, "repair_ticket_id"),
    inspectionId: optionalField(fields, "inspection_id"),
    quantity: numberField(fields, "quantity", "Quantity") ?? 0,
    description: optionalField(fields, "description") ?? "",
    supplierName: optionalField(fields, "supplier_name"),
    supplierUrl: optionalField(fields, "supplier_url"),
    neededBy: optionalField(fields, "needed_by"),
    estimatedUnitCostCents: centsField(fields, "unit_cost", "Unit cost"),
  });
  if (wantsJson(ctx)) return json({ id }, 201);
  const target = safeRedirectPath(fields.redirect_to, "/inventory/requests");
  return redirect(`${target}?ok=requested`);
}

async function advanceRequestRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "material_request.approve");
  const fields = await readFields(ctx.request);
  const status = requiredField(fields, "status", "Status") as (typeof REQUEST_STATUSES)[number];
  await advanceMaterialRequest(ctx.db, ctx.actor, {
    requestId: ctx.params.id,
    status,
    receivedQuantity: numberField(fields, "received_quantity", "Received quantity"),
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/inventory/requests?ok=${status === "received" ? "received" : "saved"}`);
}
