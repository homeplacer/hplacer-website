/** Repair tickets, defect reports, and Tara's bill-back queue. */
import { assertCan, can } from "../auth/authz.ts";
import { listAssets } from "../domain/assets.ts";
import { DEFECT_SEVERITIES, getDefect, listDefects, reportDefect, resolveDefect } from "../domain/defects.ts";
import { listDocuments } from "../domain/documents.ts";
import { listEmployees } from "../domain/employees.ts";
import { listHomes } from "../domain/homes.ts";
import { listParts } from "../domain/inventory.ts";
import {
  BILL_BACK_STATUSES,
  REPAIR_STATUSES,
  RESPONSIBLE_PARTY_TYPES,
  addLabor,
  addMaterial,
  assertCanViewRepair,
  billingQueue,
  createRepair,
  listLabor,
  listMaterials,
  listRepairs,
  listStatusEvents,
  requireRepair,
  setRepairStatus,
  setResponsibleParty,
  updateBillBack,
  type BillBackStatus,
  type RepairStatus,
} from "../domain/repairs.ts";
import { boolField, centsField, numberField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query, raw } from "../ui/html.ts";
import { badge, empty, formatDate, hoursMinutes, kv, money, page, tabs } from "../ui/layout.ts";
import { documentList, uploadForm } from "./documents.ts";
import { wantsJson } from "./equipment.ts";

export function registerRepairs(router: Router): void {
  router.get("/repairs", renderList);
  router.get("/repairs/new", renderNewRepair);
  router.get("/repairs/:id", renderDetail);
  router.get("/billing", renderBillingQueue);
  router.get("/defects", renderDefects);
  router.get("/defects/new", renderNewDefect);

  router.post("/api/repairs", createRepairRoute);
  router.post("/api/repairs/:id/status", statusRoute);
  router.post("/api/repairs/:id/responsible-party", responsiblePartyRoute);
  router.post("/api/repairs/:id/labor", laborRoute);
  router.post("/api/repairs/:id/materials", materialsRoute);
  router.post("/api/repairs/:id/bill-back", billBackRoute);
  router.post("/api/defects", reportDefectRoute);
  router.post("/api/defects/:id/resolve", resolveDefectRoute);

  router.get("/api/repairs", async (ctx) =>
    json({
      repairs: await listRepairs(ctx.db, ctx.actor, {
        status: ctx.url.searchParams.get("status") ?? undefined,
        billBackStatus: ctx.url.searchParams.get("billBack") ?? undefined,
        openOnly: ctx.url.searchParams.get("open") === "1",
      }),
    }),
  );
  router.get("/api/billing/queue", async (ctx) => {
    assertCan(ctx.actor, "repair.bill");
    return json({ queue: await billingQueue(ctx.db) });
  });
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

async function renderList(ctx: RequestContext): Promise<Response> {
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const repairs = await listRepairs(ctx.db, ctx.actor, { status, openOnly: !status });

  const body = html`
    <h1>Repairs</h1>
    ${tabs([
      { href: "/repairs", label: "Open", current: !status },
      ...REPAIR_STATUSES.map((value) => ({
        href: `/repairs${query({ status: value })}`,
        label: value.replace(/_/g, " "),
        current: status === value,
      })),
    ])}
    ${repairs.length === 0
      ? empty("No repair tickets here.")
      : repairs.map(ticketCard)}
    <div class="btn-row">
      <a class="btn" href="/repairs/new">New repair ticket</a>
      <a class="btn secondary" href="/defects">Open defects</a>
      ${can(ctx.actor, "repair.bill") ? html`<a class="btn secondary" href="/billing">Billing queue</a>` : ""}
    </div>
  `;
  return page(body, { title: "Repairs", actor: ctx.actor, section: "/repairs", flash: flashFrom(ctx.url) });
}

function ticketCard(ticket: Awaited<ReturnType<typeof listRepairs>>[number]) {
  return html`<a class="card" href="/repairs/${ticket.id}">
    <div class="row"><h3>${ticket.ticket_number} — ${ticket.title}</h3>
      ${badge(ticket.status, ticket.status === "billed" || ticket.status === "closed" ? "ok" : "")}</div>
    <div class="meta">${ticket.serial_number ?? ticket.asset_tag ?? "—"} · ${ticket.reported_by_name} · ${formatDate(ticket.created_at)}
      · ${money(ticket.total_cents)} recorded
      ${ticket.bill_back_status !== "not_applicable" ? html` · ${badge(ticket.bill_back_status, ticket.bill_back_status === "billed" ? "ok" : "warn")}` : ""}</div>
  </a>`;
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  const repair = await requireRepair(ctx.db, ctx.params.id);
  assertCanViewRepair(ctx.actor, repair);

  const labor = await listLabor(ctx.db, repair.id);
  const materials = await listMaterials(ctx.db, repair.id);
  const events = await listStatusEvents(ctx.db, repair.id);
  const documents = await listDocuments(ctx.db, { repairTicketId: repair.id });
  const parts = can(ctx.actor, "inventory.read") ? await listParts(ctx.db) : [];
  const employees = can(ctx.actor, "repair.edit") ? await listEmployees(ctx.db) : [];

  const body = html`
    <h1>${repair.ticket_number}</h1>
    <p class="lede">${repair.title}</p>

    <div class="card">
      <div class="row">
        ${badge(repair.status, repair.status === "billed" || repair.status === "closed" ? "ok" : "")}
        ${repair.bill_back_status !== "not_applicable"
          ? badge(repair.bill_back_status, repair.bill_back_status === "billed" ? "ok" : repair.bill_back_status === "denied" ? "bad" : "warn")
          : ""}
      </div>
      <p>${repair.description}</p>
      ${kv([
        ["Home", repair.serial_number ? html`<a href="/homes/${repair.home_id}">${repair.serial_number}</a>` : null],
        ["Equipment", repair.asset_tag ? html`<a href="/equipment/${repair.asset_tag}">${repair.asset_tag}</a>` : null],
        ["Subdivision", repair.job_number ? html`<a href="/subdivisions/${repair.job_id}">${repair.job_number}</a>` : null],
        ["Reported by", `${repair.reported_by_name} · ${formatDate(repair.created_at)}`],
        ["Assigned to", repair.assigned_to_name],
        ["Responsible party", repair.responsible_party_type ? `${repair.responsible_party_type.replace(/_/g, " ")}${repair.responsible_party ? ` — ${repair.responsible_party}` : ""}` : null],
        ["Labor", `${hoursMinutes(repair.labor_minutes)} · ${money(repair.labor_cents)}`],
        ["Materials", money(repair.material_cents)],
        ["Total", money(repair.total_cents)],
        ["Billed back", repair.bill_back_amount_cents != null ? `${money(repair.bill_back_amount_cents)} · ${repair.invoice_reference ?? ""}` : null],
        ["Billing notes", repair.billing_notes],
        ["Source inspection", repair.source_inspection_id ? html`<a href="/inspections/${repair.source_inspection_id}">Open inspection</a>` : null],
      ])}
    </div>

    <h2>Photos and receipts</h2>
    ${documentList(documents)}
    ${uploadForm(ctx.actor, { repairTicketId: repair.id }, `/repairs/${repair.id}`)}

    <h2>Labor</h2>
    ${labor.length === 0
      ? empty("No labor recorded.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Who</th><th>Time</th><th>Rate</th><th>Cost</th></tr></thead>
          <tbody>${labor.map(
            (entry) => html`<tr>
              <td>${entry.worked_on}</td><td>${entry.employee_name}</td><td>${hoursMinutes(entry.minutes)}</td>
              <td>${money(entry.rate_cents_per_hour)}/h</td>
              <td>${money(Math.round((entry.minutes * entry.rate_cents_per_hour) / 60))}</td>
            </tr>`,
          )}</tbody></table></div>`}

    ${can(ctx.actor, "repair.edit") && repair.status !== "closed"
      ? html`<details class="card">
          <summary><strong>Add labor</strong></summary>
          <form method="post" action="/api/repairs/${repair.id}/labor">
            <label for="employee_id">Who</label>
            <select id="employee_id" name="employee_id">
              ${employees.map((person) => html`<option value="${person.id}" ${raw(person.id === ctx.actor.employeeId ? "selected" : "")}>${person.display_name}</option>`)}
            </select>
            <label for="worked_on">Date worked</label>
            <input id="worked_on" name="worked_on" placeholder="2026-08-21" required>
            <label for="minutes">Minutes</label>
            <input id="minutes" name="minutes" inputmode="numeric" required>
            <label for="rate">Rate (USD per hour)</label>
            <input id="rate" name="rate" inputmode="decimal" value="85">
            <label for="labor_description">Notes</label>
            <input id="labor_description" name="description">
            <div class="btn-row"><button type="submit">Add labor</button></div>
          </form>
        </details>`
      : ""}

    <h2>Materials</h2>
    ${materials.length === 0
      ? empty("No materials recorded.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Cost</th></tr></thead>
          <tbody>${materials.map(
            (line) => html`<tr>
              <td>${line.sku ? `${line.sku} — ` : ""}${line.description}</td>
              <td>${line.quantity}</td><td>${money(line.unit_cost_cents)}</td>
              <td>${money(Math.round(line.quantity * line.unit_cost_cents))}</td>
            </tr>`,
          )}</tbody></table></div>`}

    ${can(ctx.actor, "repair.edit") && repair.status !== "closed"
      ? html`<details class="card">
          <summary><strong>Add materials</strong></summary>
          <form method="post" action="/api/repairs/${repair.id}/materials">
            <label for="part_id">From stock</label>
            <select id="part_id" name="part_id">
              <option value="">Not a stocked part</option>
              ${parts.map((part) => html`<option value="${part.id}">${part.sku} — ${part.name} (${part.quantity_on_hand} on hand)</option>`)}
            </select>
            <label for="material_description">Description</label>
            <input id="material_description" name="description">
            <label for="quantity">Quantity</label>
            <input id="quantity" name="quantity" inputmode="decimal" required>
            <label for="unit_cost">Unit cost (USD)</label>
            <input id="unit_cost" name="unit_cost" inputmode="decimal" required>
            <label><input type="checkbox" name="consume_stock" value="on" checked> Draw it out of shop stock</label>
            <div class="btn-row"><button type="submit">Add materials</button></div>
          </form>
        </details>
        <details class="card">
          <summary><strong>Request a part we do not have</strong></summary>
          <form method="post" action="/api/inventory/requests">
            <input type="hidden" name="repair_ticket_id" value="${repair.id}">
            <input type="hidden" name="redirect_to" value="/repairs/${repair.id}">
            <label for="request_description">What do you need?</label>
            <input id="request_description" name="description" required>
            <label for="request_quantity">How many</label>
            <input id="request_quantity" name="quantity" inputmode="decimal" required>
            <label for="supplier_name">Supplier</label>
            <input id="supplier_name" name="supplier_name">
            <label for="supplier_url">Supplier link</label>
            <input id="supplier_url" name="supplier_url" inputmode="url">
            <label for="needed_by">Needed by</label>
            <input id="needed_by" name="needed_by" placeholder="2026-08-27">
            <div class="btn-row"><button class="secondary" type="submit">Send request</button></div>
          </form>
        </details>`
      : ""}

    ${can(ctx.actor, "repair.approve") || can(ctx.actor, "repair.edit")
      ? html`<h2>Move this ticket</h2>
        <form class="card" method="post" action="/api/repairs/${repair.id}/status">
          <label for="status">Status</label>
          <select id="status" name="status">
            ${REPAIR_STATUSES.filter((value) => value !== "billed").map(
              (value) => html`<option value="${value}" ${raw(value === repair.status ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
            )}
          </select>
          <label for="status_note">Note</label>
          <input id="status_note" name="note">
          <div class="btn-row"><button type="submit">Update status</button></div>
        </form>

        <form class="card" method="post" action="/api/repairs/${repair.id}/responsible-party">
          <label for="responsible_party_type">Who is responsible?</label>
          <select id="responsible_party_type" name="responsible_party_type">
            ${RESPONSIBLE_PARTY_TYPES.map(
              (value) => html`<option value="${value}" ${raw(value === repair.responsible_party_type ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
            )}
          </select>
          <label for="responsible_party">Name them</label>
          <input id="responsible_party" name="responsible_party" value="${repair.responsible_party ?? ""}">
          <div class="btn-row"><button class="secondary" type="submit">Save responsible party</button></div>
        </form>`
      : ""}

    ${can(ctx.actor, "repair.bill") ? billBackForm(repair) : ""}

    <h2>History</h2>
    ${events.length === 0
      ? empty("No changes recorded yet.")
      : events.map(
          (event) => html`<div class="card">
            <div class="meta">${formatDate(event.created_at)} · ${event.changed_by_name}</div>
            <div>${event.field.replace(/_/g, " ")}: ${event.from_value ?? "—"} → <strong>${event.to_value}</strong></div>
            ${event.note ? html`<p class="meta">${event.note}</p>` : ""}
          </div>`,
        )}
  `;

  return page(body, {
    title: repair.ticket_number,
    actor: ctx.actor,
    section: "/repairs",
    back: { href: "/repairs", label: "Repairs" },
    flash: flashFrom(ctx.url),
  });
}

function billBackForm(repair: Awaited<ReturnType<typeof requireRepair>>) {
  return html`
    <h2>Bill back</h2>
    <form class="card" method="post" action="/api/repairs/${repair.id}/bill-back">
      <label for="bill_back_status">Queue status</label>
      <select id="bill_back_status" name="bill_back_status">
        ${BILL_BACK_STATUSES.map(
          (value) => html`<option value="${value}" ${raw(value === repair.bill_back_status ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`,
        )}
      </select>
      <label for="amount">Amount billed (USD)</label>
      <input id="amount" name="amount" inputmode="decimal"
             value="${repair.bill_back_amount_cents != null ? (repair.bill_back_amount_cents / 100).toFixed(2) : (repair.total_cents / 100).toFixed(2)}">
      <label for="invoice_reference">Invoice / claim reference</label>
      <input id="invoice_reference" name="invoice_reference" value="${repair.invoice_reference ?? ""}">
      <label for="billing_notes">Billing notes</label>
      <textarea id="billing_notes" name="notes"></textarea>
      <div class="btn-row"><button type="submit">Save bill-back</button></div>
    </form>`;
}

async function renderBillingQueue(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.bill");
  const queue = await billingQueue(ctx.db);
  const total = queue.reduce((sum, ticket) => sum + ticket.total_cents, 0);

  const body = html`
    <h1>Bill-back queue</h1>
    <p class="lede">${queue.length} ticket${queue.length === 1 ? "" : "s"} · ${money(total)} of recorded cost awaiting a decision.</p>
    ${queue.length === 0
      ? empty("The queue is clear.")
      : queue.map(
          (ticket) => html`<a class="card" href="/repairs/${ticket.id}">
            <div class="row"><h3>${ticket.ticket_number} — ${ticket.title}</h3>
              ${badge(ticket.bill_back_status, ticket.bill_back_status === "ready_to_bill" ? "warn" : "")}</div>
            <div class="meta">${ticket.serial_number ?? ticket.asset_tag ?? "—"} ·
              ${ticket.responsible_party ?? ticket.responsible_party_type ?? "responsible party not set"} ·
              labor ${money(ticket.labor_cents)} + materials ${money(ticket.material_cents)} = <strong>${money(ticket.total_cents)}</strong>
              ${ticket.status !== "complete" ? " · repair not finished" : ""}</div>
          </a>`,
        )}
  `;
  return page(body, { title: "Billing", actor: ctx.actor, section: "/repairs", back: { href: "/repairs", label: "Repairs" }, flash: flashFrom(ctx.url) });
}

async function renderDefects(ctx: RequestContext): Promise<Response> {
  const defects = await listDefects(ctx.db, { openOnly: ctx.url.searchParams.get("all") !== "1" });
  const body = html`
    <h1>Defects</h1>
    ${tabs([
      { href: "/defects", label: "Open", current: ctx.url.searchParams.get("all") !== "1" },
      { href: "/defects?all=1", label: "All", current: ctx.url.searchParams.get("all") === "1" },
    ])}
    ${defects.length === 0
      ? empty("Nothing open.")
      : defects.map(
          (defect) => html`<div class="card">
            <div class="row"><h3>${defect.summary}</h3>
              ${badge(defect.severity, defect.severity === "critical" ? "bad" : defect.severity === "major" ? "warn" : "")}</div>
            <div class="meta">${badge(defect.status, defect.status === "open" ? "warn" : "ok")}
              ${defect.asset_tag ?? defect.serial_number ?? ""} · ${defect.reported_by_name} · ${formatDate(defect.created_at)}
              · ${defect.source.replace(/_/g, " ")}</div>
            ${defect.detail ? html`<p>${defect.detail}</p>` : ""}
            <div class="btn-row">
              ${defect.repair_ticket_id
                ? html`<a class="btn secondary" href="/repairs/${defect.repair_ticket_id}">${defect.ticket_number}</a>`
                : html`<a class="btn secondary" href="/repairs/new?defectId=${defect.id}${defect.asset_id ? `&assetId=${defect.asset_id}` : ""}${defect.home_id ? `&homeId=${defect.home_id}` : ""}">Open a ticket</a>`}
              ${can(ctx.actor, "defect.resolve") && defect.status === "open"
                ? html`<form method="post" action="/api/defects/${defect.id}/resolve">
                    <input type="hidden" name="status" value="resolved">
                    <input type="hidden" name="note" value="Closed from the defect list">
                    <button class="secondary" type="submit">Mark resolved</button>
                  </form>`
                : ""}
            </div>
          </div>`,
        )}
    <div class="btn-row"><a class="btn" href="/defects/new">Report a problem</a></div>
  `;
  return page(body, { title: "Defects", actor: ctx.actor, section: "/repairs", flash: flashFrom(ctx.url) });
}

async function renderNewDefect(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "defect.report");
  const assets = await listAssets(ctx.db);
  const homes = await listHomes(ctx.db);
  const body = html`
    <h1>Report a problem</h1>
    <p class="lede">This opens a defect. A supervisor turns it into a repair ticket.</p>
    <form method="post" action="/api/defects">
      <label for="summary">What is wrong?</label>
      <input id="summary" name="summary" required>
      <label for="detail">Details</label>
      <textarea id="detail" name="detail"></textarea>
      <label for="severity">Severity</label>
      <select id="severity" name="severity">
        ${DEFECT_SEVERITIES.map((value) => html`<option value="${value}" ${raw(value === "major" ? "selected" : "")}>${value}</option>`)}
      </select>
      <label for="asset_id">Equipment</label>
      <select id="asset_id" name="asset_id">
        <option value="">Not equipment</option>
        ${assets.map((asset) => html`<option value="${asset.id}" ${raw(asset.id === ctx.url.searchParams.get("assetId") ? "selected" : "")}>${asset.asset_tag}</option>`)}
      </select>
      <label for="home_id">Home</label>
      <select id="home_id" name="home_id">
        <option value="">Not a home</option>
        ${homes.map((home) => html`<option value="${home.id}" ${raw(home.id === ctx.url.searchParams.get("homeId") ? "selected" : "")}>${home.serial_number}</option>`)}
      </select>
      <div class="btn-row"><button type="submit">Report</button></div>
    </form>
  `;
  return page(body, { title: "Report a problem", actor: ctx.actor, section: "/repairs", back: { href: "/defects", label: "Defects" } });
}

async function renderNewRepair(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.create");
  const assets = await listAssets(ctx.db);
  const homes = await listHomes(ctx.db);
  const defectId = ctx.url.searchParams.get("defectId");
  const defect = defectId ? await getDefect(ctx.db, defectId) : null;
  const presetAsset = ctx.url.searchParams.get("assetId") ?? defect?.asset_id ?? "";
  const presetHome = ctx.url.searchParams.get("homeId") ?? defect?.home_id ?? "";

  const body = html`
    <h1>New repair ticket</h1>
    ${defect ? html`<div class="notice">Opening a ticket from defect: ${defect.summary}</div>` : ""}
    <form method="post" action="/api/repairs">
      ${defect ? html`<input type="hidden" name="source_defect_id" value="${defect.id}">` : ""}
      ${defect?.inspection_id ? html`<input type="hidden" name="source_inspection_id" value="${defect.inspection_id}">` : ""}
      <label for="title">Short title</label>
      <input id="title" name="title" required value="${defect?.summary ?? ""}">
      <label for="description">What happened?</label>
      <textarea id="description" name="description" required>${defect?.detail ?? ""}</textarea>
      <label for="home_id">Home</label>
      <select id="home_id" name="home_id">
        <option value="">Not a home</option>
        ${homes.map((home) => html`<option value="${home.id}" ${raw(home.id === presetHome ? "selected" : "")}>${home.serial_number}</option>`)}
      </select>
      <label for="asset_id">Equipment</label>
      <select id="asset_id" name="asset_id">
        <option value="">Not equipment</option>
        ${assets.map((asset) => html`<option value="${asset.id}" ${raw(asset.id === presetAsset ? "selected" : "")}>${asset.asset_tag}</option>`)}
      </select>
      <label for="responsible_party_type">Who looks responsible?</label>
      <select id="responsible_party_type" name="responsible_party_type">
        ${RESPONSIBLE_PARTY_TYPES.map((value) => html`<option value="${value}" ${raw(value === "unknown" ? "selected" : "")}>${value.replace(/_/g, " ")}</option>`)}
      </select>
      <label for="responsible_party">Name them (transport company, factory, vendor…)</label>
      <input id="responsible_party" name="responsible_party">
      <label><input type="checkbox" name="bill_back" value="on"> Someone else should pay for this — send it to billing for review</label>
      <div class="btn-row"><button type="submit">Create ticket</button></div>
    </form>
  `;
  return page(body, { title: "New repair", actor: ctx.actor, section: "/repairs", back: { href: "/repairs", label: "Repairs" } });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createRepairRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.create");
  const fields = await readFields(ctx.request);
  const id = await createRepair(ctx.db, ctx.actor, {
    title: requiredField(fields, "title", "Title"),
    description: requiredField(fields, "description", "Description"),
    homeId: optionalField(fields, "home_id"),
    assetId: optionalField(fields, "asset_id"),
    jobId: optionalField(fields, "job_id"),
    sourceInspectionId: optionalField(fields, "source_inspection_id"),
    sourceDefectId: optionalField(fields, "source_defect_id"),
    responsibleParty: optionalField(fields, "responsible_party"),
    responsiblePartyType: optionalField(fields, "responsible_party_type"),
    billBack: boolField(fields, "bill_back"),
    assignedTo: optionalField(fields, "assigned_to"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/repairs/${id}?ok=ticket_created`);
}

async function statusRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.edit");
  const fields = await readFields(ctx.request);
  await setRepairStatus(ctx.db, ctx.actor, ctx.params.id, requiredField(fields, "status", "Status") as RepairStatus, optionalField(fields, "note"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/repairs/${ctx.params.id}?ok=ticket_updated`);
}

async function responsiblePartyRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.edit");
  const fields = await readFields(ctx.request);
  await setResponsibleParty(
    ctx.db,
    ctx.actor,
    ctx.params.id,
    requiredField(fields, "responsible_party_type", "Responsible party"),
    optionalField(fields, "responsible_party"),
  );
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/repairs/${ctx.params.id}?ok=ticket_updated`);
}

async function laborRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.edit");
  const fields = await readFields(ctx.request);
  const id = await addLabor(ctx.db, ctx.actor, {
    repairId: ctx.params.id,
    employeeId: requiredField(fields, "employee_id", "Employee"),
    workedOn: requiredField(fields, "worked_on", "Date worked"),
    minutes: numberField(fields, "minutes", "Minutes") ?? 0,
    rateCentsPerHour: centsField(fields, "rate", "Rate") ?? 0,
    description: optionalField(fields, "description"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/repairs/${ctx.params.id}?ok=saved`);
}

async function materialsRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.edit");
  const fields = await readFields(ctx.request);
  const id = await addMaterial(ctx.db, ctx.actor, {
    repairId: ctx.params.id,
    partId: optionalField(fields, "part_id"),
    description: optionalField(fields, "description") ?? "",
    quantity: numberField(fields, "quantity", "Quantity") ?? 0,
    unitCostCents: centsField(fields, "unit_cost", "Unit cost") ?? 0,
    consumeStock: boolField(fields, "consume_stock"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/repairs/${ctx.params.id}?ok=saved`);
}

async function billBackRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "repair.bill");
  const fields = await readFields(ctx.request);
  const billBackStatus = requiredField(fields, "bill_back_status", "Bill-back status") as BillBackStatus;
  await updateBillBack(ctx.db, ctx.actor, {
    repairId: ctx.params.id,
    billBackStatus,
    amountCents: centsField(fields, "amount", "Amount"),
    invoiceReference: optionalField(fields, "invoice_reference"),
    notes: optionalField(fields, "notes"),
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/repairs/${ctx.params.id}?ok=${billBackStatus === "billed" ? "billed" : "ticket_updated"}`);
}

async function reportDefectRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "defect.report");
  const fields = await readFields(ctx.request);
  const id = await reportDefect(ctx.db, ctx.actor, {
    summary: requiredField(fields, "summary", "Summary"),
    detail: optionalField(fields, "detail"),
    severity: (optionalField(fields, "severity") ?? "major") as "minor" | "major" | "critical",
    assetId: optionalField(fields, "asset_id"),
    homeId: optionalField(fields, "home_id"),
    jobId: optionalField(fields, "job_id"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/defects?ok=saved#${id}`);
}

async function resolveDefectRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "defect.resolve");
  const fields = await readFields(ctx.request);
  const status = (optionalField(fields, "status") ?? "resolved") as "resolved" | "dismissed";
  await resolveDefect(ctx.db, ctx.actor, ctx.params.id, status, optionalField(fields, "note") ?? undefined);
  return wantsJson(ctx) ? json({ ok: true }) : redirect("/defects?ok=saved");
}
