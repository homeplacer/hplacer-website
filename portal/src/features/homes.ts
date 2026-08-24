/** Manufactured homes: the serial-number record and its three reports. */
import { assertCan, can } from "../auth/authz.ts";
import { listDocuments } from "../domain/documents.ts";
import { listDefects } from "../domain/defects.ts";
import {
  HOME_STATUSES,
  assignHomeToLot,
  createHome,
  formatSiteAddress,
  homeRepairHistory,
  homeReportTemplateKey,
  homeReports,
  listHomes,
  requireHome,
  updateSiteAddress,
} from "../domain/homes.ts";
import { getJob, listJobs, listLots } from "../domain/jobs.ts";
import { listInspections, loadTemplate } from "../domain/inspections.ts";
import { listWarrantyRequests } from "../domain/warranty.ts";
import { homeWorkflow, saveDeliveryDate } from "../domain/home-workflow.ts";
import { getLink } from "../integrations/monday.ts";
import { badRequest } from "../platform/errors.ts";
import { numberField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query, raw } from "../ui/html.ts";
import { badge, empty, externalLink, formatDate, kv, money, page, tabs } from "../ui/layout.ts";
import { documentList, homeComplianceUploadForm, uploadForm } from "./documents.ts";
import { wantsJson } from "./equipment.ts";

const REPORT_FIELDS: Record<string, { key: string; label: string }[]> = {
  delivery: [
    { key: "transporter", label: "Transport company" },
    { key: "driver", label: "Driver" },
    { key: "arrived_at", label: "Arrived (date/time)" },
    { key: "sections_delivered", label: "Sections delivered" },
  ],
  setup: [
    { key: "pier_count", label: "Piers installed" },
    { key: "anchor_count", label: "Anchors installed" },
    { key: "setup_manual", label: "Manufacturer setup manual revision" },
    { key: "installer_license", label: "Installer license number" },
  ],
  final_inspection: [
    { key: "inspector", label: "Local inspector" },
    { key: "permit_number", label: "Permit number" },
    { key: "walkthrough_with", label: "Walkthrough attended by" },
  ],
};

export function registerHomes(router: Router): void {
  router.get("/homes", renderList);
  router.get("/homes/new", renderNewHome);
  router.get("/homes/:id", renderDetail);
  router.get("/homes/:id/report/:kind", renderReportForm);

  router.post("/api/homes", createHomeRoute);
  router.post("/api/homes/:id/lot", assignLotRoute);
  router.post("/api/homes/:id/site-address", updateSiteAddressRoute);
  router.post("/api/homes/:id/workflow/delivery-date", saveDeliveryDateRoute);

  router.get("/api/homes", async (ctx) => {
    assertCan(ctx.actor, "home.read");
    const homes = await listHomes(ctx.db, {
      status: ctx.url.searchParams.get("status") ?? undefined,
      search: ctx.url.searchParams.get("q") ?? undefined,
    });
    return json({ homes });
  });
}

async function renderList(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.read");
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const search = ctx.url.searchParams.get("q") ?? undefined;
  const homes = await listHomes(ctx.db, { status, search });

  const body = html`
    <h1>Homes</h1>
    <p class="lede">Every home is filed under its serial number.</p>

    <form method="get" action="/homes">
      <label for="q">Search serial, model, or make</label>
      <input id="q" name="q" value="${search ?? ""}" inputmode="search" autocapitalize="characters" autocomplete="off">
      <div class="btn-row"><button type="submit">Search</button></div>
    </form>

    ${tabs([
      { href: "/homes", label: "All", current: !status },
      ...HOME_STATUSES.map((value) => ({
        href: `/homes${query({ status: value, q: search })}`,
        label: value.replace(/_/g, " "),
        current: status === value,
      })),
    ])}

    ${homes.length === 0
      ? empty("No homes match that.")
      : homes.map(
          (home) => html`<a class="card" href="/homes/${home.id}">
            <div class="row"><h3>${home.serial_number}</h3>${badge(home.status, home.status === "complete" ? "ok" : "")}</div>
            <div class="meta">${home.manufacturer ?? ""} ${home.model ?? ""}
              ${home.job_number ? ` · ${home.job_number}` : ""}${home.lot_number ? ` lot ${home.lot_number}` : ""}
              ${home.open_repair_count > 0 ? ` · ${home.open_repair_count} open repair(s)` : ""}</div>
            ${formatSiteAddress(home) ? html`<div class="meta">${formatSiteAddress(home)}</div>` : ""}
          </a>`,
        )}

    ${can(ctx.actor, "home.write") ? html`<div class="btn-row"><a class="btn secondary" href="/homes/new">Add a home</a></div>` : ""}
  `;
  return page(body, { title: "Homes", actor: ctx.actor, section: "/homes", flash: flashFrom(ctx.url) });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.read");
  const home = await requireHome(ctx.db, ctx.params.id);
  const job = home.job_id ? await getJob(ctx.db, home.job_id) : null;
  const lots = home.job_id ? await listLots(ctx.db, home.job_id) : [];
  const lot = lots.find((candidate) => candidate.id === home.lot_id) ?? null;
  const reports = await homeReports(ctx.db, home.id);
  const repairs = await homeRepairHistory(ctx.db, home.id);
  const defects = await listDefects(ctx.db, { homeId: home.id, openOnly: true });
  const documents = await listDocuments(ctx.db, { homeId: home.id });
  const inspections = await listInspections(ctx.db, { homeId: home.id, limit: 20 });
  const link = await getLink(ctx.db, "home", home.id);
  const warranty = await listWarrantyRequests(ctx.db, { homeId: home.id, limit: 20 });
  const workflow = await homeWorkflow(ctx.db, home.id);

  const billedTotal = repairs
    .filter((repair) => repair.bill_back_status === "billed")
    .reduce((sum, repair) => sum + (repair.bill_back_amount_cents ?? 0), 0);

  const body = html`
    <h1>${home.serial_number}</h1>
    <p class="lede">${home.manufacturer ?? ""} ${home.model ?? ""} ${home.model_year ?? ""}</p>

    <div class="card">
      <div class="row">${badge(home.status, home.status === "complete" ? "ok" : "")}</div>
      ${kv([
        ["Subdivision", job ? html`<a href="/subdivisions/${job.id}">${job.job_number} — ${job.title}</a>` : null],
        ["Lot", lot ? `Lot ${lot.lot_number}` : null],
        ["Map", lot ? externalLink(lot.google_maps_url, "Open in Google Maps") : externalLink(job?.google_maps_url, "Open in Google Maps")],
        ["Plat", lot ? externalLink(lot.plat_drive_url, "Plat in Drive") : null],
        ["Permit", lot ? externalLink(lot.permit_drive_url, "Permit in Drive") : null],
        ["Sections", home.section_count],
        ["HUD labels", home.hud_label_numbers],
        ["Delivered", home.delivered_on],
        ["Setup complete", home.setup_completed_on],
        ["Final inspection", home.final_inspection_on],
        ["Warranty ends", home.warranty_expires_on],
        ["Monday item", link ? `${link.monday_item_id} (${link.sync_state})` : "not linked"],
      ])}
    </div>

    <h2>Home checklist</h2>
    ${workflow.map((item) => html`<div class="card">
      <div class="row"><h3>${item.label}</h3>${badge(item.value_date ? "scheduled" : "not set", item.value_date ? "ok" : "warn")}</div>
      ${can(ctx.actor, "home.workflow.edit")
        ? html`<form method="post" action="/api/homes/${home.id}/workflow/delivery-date">
            <label for="delivery_date">${item.label}</label>
            <input id="delivery_date" name="delivery_date" type="date" value="${item.value_date ?? ""}">
            <div class="btn-row"><button type="submit">Save delivery date</button></div>
            <p class="meta">This is the planned date. The delivery report records when delivery actually happened.
              ${item.updated_at ? ` Last updated ${formatDate(item.updated_at)} by ${item.updated_by_name}.` : ""}</p>
          </form>`
        : html`<p>${item.value_date ? formatDate(item.value_date) : "No date selected."}</p>`}
    </div>`)}

    <h2>Site address</h2>
    <div class="card">
      ${formatSiteAddress(home)
        ? kv([
            ["Address", formatSiteAddress(home)],
            ["Directions", home.site_address_notes],
            ["Owner", home.customer_name],
            ["Phone", home.customer_phone],
            ["Email", home.customer_email],
          ])
        : html`<p class="meta">No site address recorded. Adding one lets a homeowner's warranty request
            find this home even when they do not have the serial number.</p>`}
    </div>

    ${can(ctx.actor, "home.address.edit")
      ? html`<details class="card" ${raw(formatSiteAddress(home) ? "" : "open")}>
          <summary><strong>${formatSiteAddress(home) ? "Edit the site address" : "Add a site address"}</strong></summary>
          <form method="post" action="/api/homes/${home.id}/site-address">
            <label for="site_address">Street address</label>
            <input id="site_address" name="site_address" value="${home.site_address ?? ""}" autocomplete="off"
                   placeholder="184 Mill Creek Rd Lot 12">
            <label for="site_city">City</label>
            <input id="site_city" name="site_city" value="${home.site_city ?? ""}">
            <label for="site_state">State</label>
            <input id="site_state" name="site_state" maxlength="2" value="${home.site_state ?? ""}">
            <label for="site_postal_code">ZIP</label>
            <input id="site_postal_code" name="site_postal_code" inputmode="numeric" value="${home.site_postal_code ?? ""}">
            <label for="site_address_notes">Directions or access notes</label>
            <textarea id="site_address_notes" name="site_address_notes">${home.site_address_notes ?? ""}</textarea>
            <label for="customer_name">Owner of record</label>
            <input id="customer_name" name="customer_name" value="${home.customer_name ?? ""}">
            <label for="customer_phone">Owner phone</label>
            <input id="customer_phone" name="customer_phone" inputmode="tel" value="${home.customer_phone ?? ""}">
            <label for="customer_email">Owner email</label>
            <input id="customer_email" name="customer_email" type="email" value="${home.customer_email ?? ""}">
            <div class="btn-row"><button type="submit">Save site address</button></div>
            <p class="meta">Leave a field blank to clear it. The address and phone are normalized for
              warranty matching — you do not have to type them a particular way.</p>
          </form>
        </details>`
      : ""}

    <h2>Reports</h2>
    ${reports.map(
      (report) => html`<div class="card">
        <div class="row">
          <h3>${report.label}</h3>
          ${report.inspection_id
            ? badge(report.status ?? "filed", report.status === "passed" ? "ok" : "warn")
            : badge("not filed", "warn")}
        </div>
        <div class="meta">${report.inspection_id ? `${formatDate(report.performed_at)} · ${report.performed_by_name}` : "No report yet"}
          ${report.defect_count > 0 ? ` · ${report.defect_count} defect(s)` : ""}</div>
        <div class="btn-row">
          ${report.inspection_id ? html`<a class="btn secondary" href="/inspections/${report.inspection_id}">Open report</a>` : ""}
          ${can(ctx.actor, "home.report.submit")
            ? html`<a class="btn" href="/homes/${home.id}/report/${report.kind}">${report.inspection_id ? "File again" : "File report"}</a>`
            : ""}
        </div>
      </div>`,
    )}

    ${defects.length > 0
      ? html`<h2>Open defects</h2>
          ${defects.map(
            (defect) => html`<div class="card">
              <div class="row"><h3>${defect.summary}</h3>${badge(defect.severity, defect.severity === "critical" ? "bad" : "warn")}</div>
              <p class="meta">${formatDate(defect.created_at)} · ${defect.reported_by_name}</p>
              ${defect.repair_ticket_id
                ? html`<a href="/repairs/${defect.repair_ticket_id}">${defect.ticket_number}</a>`
                : html`<a class="btn secondary" href="/repairs/new?homeId=${home.id}&defectId=${defect.id}">Open a ticket</a>`}
            </div>`,
          )}`
      : ""}

    <h2>Repairs and bill-backs</h2>
    ${repairs.length === 0
      ? empty("No repairs on this home.")
      : html`<div class="table-wrap"><table>
          <thead><tr><th>Ticket</th><th>Issue</th><th>Status</th><th>Bill back</th><th>Amount</th></tr></thead>
          <tbody>${repairs.map(
            (repair) => html`<tr>
              <td><a href="/repairs/${repair.id}">${repair.ticket_number}</a><br><span class="meta">${formatDate(repair.created_at)}</span></td>
              <td>${repair.title}</td>
              <td>${badge(repair.status, repair.status === "closed" || repair.status === "billed" ? "ok" : "")}</td>
              <td>${badge(repair.bill_back_status, repair.bill_back_status === "billed" ? "ok" : repair.bill_back_status === "denied" ? "bad" : "warn")}
                ${repair.responsible_party ? html`<br><span class="meta">${repair.responsible_party}</span>` : ""}</td>
              <td>${money(repair.bill_back_amount_cents)}</td>
            </tr>`,
          )}</tbody></table></div>
          <p class="meta">Billed back to date: <strong>${money(billedTotal)}</strong></p>`}
    <div class="btn-row"><a class="btn secondary" href="/repairs/new?homeId=${home.id}">Report a repair</a></div>

    ${inspections.length > 0
      ? html`<h2>All inspections</h2>
          ${inspections.map(
            (inspection) => html`<a class="card" href="/inspections/${inspection.id}">
              <div class="row"><h3>${inspection.template_name ?? inspection.inspection_kind}</h3>
                ${badge(inspection.status, inspection.status === "passed" ? "ok" : "warn")}</div>
              <div class="meta">${formatDate(inspection.performed_at)} · ${inspection.performed_by_name}</div>
            </a>`,
          )}`
      : ""}

    ${warranty.length > 0
      ? html`<h2>Warranty requests</h2>
          ${warranty.map(
            (request) => html`<a class="card" href="/warranty/${request.id}">
              <div class="row"><h3>${request.reference} — ${request.issue_summary}</h3>
                ${badge(request.status, request.status === "ticketed" ? "ok" : request.status === "needs_review" ? "warn" : "")}</div>
              <div class="meta">${request.customer_name} · ${formatDate(request.created_at)}
                ${request.ticket_number ? ` · ${request.ticket_number}` : ""}</div>
            </a>`,
          )}`
      : ""}

    <h2>Home permits and inspections</h2>
    <p class="lede">Keep the manufactured-home permit, county inspection, foundation inspection, septic or sewer paperwork, site plan, and property paperwork with this home's serial number.</p>
    ${homeComplianceUploadForm(ctx.actor, { homeId: home.id }, `/homes/${home.id}`)}

    <h2>Other documents</h2>
    ${documentList(documents)}
    ${uploadForm(ctx.actor, { homeId: home.id }, `/homes/${home.id}`)}

    ${can(ctx.actor, "home.write") && lots.length > 0
      ? html`<details class="card">
          <summary><strong>Move to another lot</strong></summary>
          <form method="post" action="/api/homes/${home.id}/lot">
            <label for="lot_id">Lot</label>
            <select id="lot_id" name="lot_id">
              ${lots.map((candidate) => html`<option value="${candidate.id}" ${raw(candidate.id === home.lot_id ? "selected" : "")}>Lot ${candidate.lot_number}</option>`)}
            </select>
            <div class="btn-row"><button type="submit">Move</button></div>
          </form>
        </details>`
      : ""}
  `;

  return page(body, {
    title: home.serial_number,
    actor: ctx.actor,
    section: "/homes",
    back: { href: "/homes", label: "Homes" },
    flash: flashFrom(ctx.url),
  });
}

async function saveDeliveryDateRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.workflow.edit");
  const fields = await readFields(ctx.request);
  await saveDeliveryDate(ctx.db, ctx.params.id, ctx.actor.employeeId, optionalField(fields, "delivery_date"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/homes/${ctx.params.id}?ok=saved`);
}

async function renderReportForm(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.report.submit");
  const home = await requireHome(ctx.db, ctx.params.id);
  const kind = ctx.params.kind as "delivery" | "setup" | "final_inspection";
  if (!["delivery", "setup", "final_inspection"].includes(kind)) throw badRequest("Unknown report");
  const template = await loadTemplate(ctx.db, homeReportTemplateKey(kind));
  const extraFields = REPORT_FIELDS[kind] ?? [];

  const body = html`
    <h1>${template.name}</h1>
    <p class="lede">${home.serial_number} · ${home.manufacturer ?? ""} ${home.model ?? ""}</p>

    <form method="post" action="/api/inspections">
      <input type="hidden" name="template_key" value="${template.template_key}">
      <input type="hidden" name="home_id" value="${home.id}">
      <input type="hidden" name="redirect_to" value="/homes/${home.id}">

      ${extraFields.length > 0
        ? html`<fieldset><legend>Details</legend>
            ${extraFields.map(
              (field) => html`
                <input type="hidden" name="label_${field.key}" value="${field.label}">
                <label for="field_${field.key}">${field.label}</label>
                <input id="field_${field.key}" name="field_${field.key}">`,
            )}
          </fieldset>`
        : ""}

      <fieldset><legend>Checklist</legend>
        ${template.items.map(
          (item) => html`
            <div class="check-row">
              <div class="q">${item.question}${item.critical === 1 ? html` ${badge("critical", "bad")}` : ""}</div>
              <div class="opts">
                ${(["pass", "fail", "not_applicable"] as const).map(
                  (value) => html`<label><input type="radio" name="answer_${item.checklist_key}" value="${value}"
                      ${raw(value === "pass" ? "checked" : "")} required><span>${value === "not_applicable" ? "N/A" : value}</span></label>`,
                )}
              </div>
            </div>
            <label class="sr-only" for="note_${item.checklist_key}">Note for ${item.question}</label>
            <input id="note_${item.checklist_key}" name="note_${item.checklist_key}" placeholder="Note (required if it fails)">`,
        )}
      </fieldset>

      <label for="notes">Anything else</label>
      <textarea id="notes" name="notes"></textarea>
      <div class="btn-row"><button type="submit">File report</button></div>
    </form>
  `;
  return page(body, {
    title: template.name,
    actor: ctx.actor,
    section: "/homes",
    back: { href: `/homes/${home.id}`, label: home.serial_number },
  });
}

async function renderNewHome(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.write");
  const jobs = await listJobs(ctx.db, { status: "active" });
  const body = html`
    <h1>Add a home</h1>
    <form method="post" action="/api/homes">
      <label for="serial_number">Serial number (from the data plate)</label>
      <input id="serial_number" name="serial_number" required autocapitalize="characters">
      <label for="manufacturer">Make</label>
      <input id="manufacturer" name="manufacturer">
      <label for="model">Model</label>
      <input id="model" name="model">
      <label for="model_year">Year</label>
      <input id="model_year" name="model_year" inputmode="numeric">
      <label for="section_count">Sections</label>
      <input id="section_count" name="section_count" inputmode="numeric">
      <label for="hud_label_numbers">HUD label numbers</label>
      <input id="hud_label_numbers" name="hud_label_numbers">
      <label for="job_id">Subdivision</label>
      <select id="job_id" name="job_id">
        <option value="">Unassigned</option>
        ${jobs.map((job) => html`<option value="${job.id}">${job.job_number} — ${job.title}</option>`)}
      </select>
      <fieldset>
        <legend>Site address (optional)</legend>
        <label for="site_address">Street address</label>
        <input id="site_address" name="site_address">
        <label for="site_city">City</label>
        <input id="site_city" name="site_city">
        <label for="site_state">State</label>
        <input id="site_state" name="site_state" maxlength="2">
        <label for="site_postal_code">ZIP</label>
        <input id="site_postal_code" name="site_postal_code" inputmode="numeric">
      </fieldset>
      <div class="btn-row"><button type="submit">Add home</button></div>
    </form>
    <p class="meta">Assign the lot from the home's page once the job is chosen.</p>
  `;
  return page(body, { title: "Add a home", actor: ctx.actor, section: "/homes", back: { href: "/homes", label: "Homes" } });
}

async function createHomeRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.write");
  const fields = await readFields(ctx.request);
  const id = await createHome(ctx.db, {
    serialNumber: requiredField(fields, "serial_number", "Serial number"),
    manufacturer: optionalField(fields, "manufacturer"),
    model: optionalField(fields, "model"),
    modelYear: numberField(fields, "model_year", "Year"),
    sectionCount: numberField(fields, "section_count", "Sections"),
    hudLabelNumbers: optionalField(fields, "hud_label_numbers"),
    jobId: optionalField(fields, "job_id"),
    lotId: optionalField(fields, "lot_id"),
    warrantyExpiresOn: optionalField(fields, "warranty_expires_on"),
    siteAddress: {
      address: optionalField(fields, "site_address"),
      city: optionalField(fields, "site_city"),
      state: optionalField(fields, "site_state"),
      postalCode: optionalField(fields, "site_postal_code"),
    },
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/homes/${id}?ok=saved`);
}

async function assignLotRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.write");
  const fields = await readFields(ctx.request);
  await assignHomeToLot(ctx.db, ctx.params.id, requiredField(fields, "lot_id", "Lot"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/homes/${ctx.params.id}?ok=saved`);
}

async function updateSiteAddressRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "home.address.edit");
  const home = await requireHome(ctx.db, ctx.params.id);
  const fields = await readFields(ctx.request);
  await updateSiteAddress(ctx.db, home.id, {
    address: optionalField(fields, "site_address"),
    city: optionalField(fields, "site_city"),
    state: optionalField(fields, "site_state"),
    postalCode: optionalField(fields, "site_postal_code"),
    notes: optionalField(fields, "site_address_notes"),
    customerName: optionalField(fields, "customer_name"),
    customerPhone: optionalField(fields, "customer_phone"),
    customerEmail: optionalField(fields, "customer_email"),
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/homes/${home.id}?ok=saved`);
}
