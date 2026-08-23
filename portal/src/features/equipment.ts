/** Equipment list, machine detail, the daily pre-use inspection, and service. */
import { assertCan, can } from "../auth/authz.ts";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  assetSourceMetadata,
  assetCanonicalKey,
  createAsset,
  createServiceSchedule,
  describeServiceDue,
  listAssets,
  listServiceRecords,
  recordService,
  requireAsset,
  resolveAssetVerification,
  serviceSchedulesFor,
  setAssetStatus,
  type AssetType,
} from "../domain/assets.ts";
import { listDefects } from "../domain/defects.ts";
import { listDocuments } from "../domain/documents.ts";
import { listEmployees } from "../domain/employees.ts";
import {
  getInspection,
  listInspections,
  submitInspection,
  templateForAssetType,
  todaysInspection,
  type AnswerInput,
  type AnswerResult,
} from "../domain/inspections.ts";
import { getLink } from "../integrations/monday.ts";
import { badRequest, notFound } from "../platform/errors.ts";
import {
  centsField,
  numberField,
  optionalField,
  readFields,
  readForm,
  requiredField,
  type RequestContext,
} from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query, raw } from "../ui/html.ts";
import { badge, empty, formatDate, kv, money, page, tabs } from "../ui/layout.ts";
import { documentList, uploadForm } from "./documents.ts";

export function registerEquipment(router: Router): void {
  router.get("/equipment", renderList);
  router.get("/equipment/new", renderNewAsset);
  router.get("/equipment/:tag", renderDetail);
  router.get("/equipment/:tag/inspect", renderInspectionForm);
  router.get("/inspections/:id", renderInspection);

  router.post("/api/equipment", createAssetRoute);
  router.post("/api/equipment/:tag/status", setStatusRoute);
  router.post("/api/equipment/:tag/service", recordServiceRoute);
  router.post("/api/equipment/:tag/schedules", createScheduleRoute);
  router.post("/api/equipment/:tag/source-verification", resolveSourceVerificationRoute);
  router.post("/api/inspections", submitInspectionRoute);

  router.get("/api/equipment", async (ctx) => {
    assertCan(ctx.actor, "asset.read");
    const assets = await listAssets(ctx.db, {
      type: ctx.url.searchParams.get("type") ?? undefined,
      status: ctx.url.searchParams.get("status") ?? undefined,
      search: ctx.url.searchParams.get("q") ?? undefined,
    });
    return json({ assets });
  });
  router.get("/api/equipment/:tag/source-verification", async (ctx) => {
    assertCan(ctx.actor, "asset.read");
    const asset = await requireAsset(ctx.db, ctx.params.tag);
    return json({ sourceMetadata: await assetSourceMetadata(ctx.db, asset.id) });
  });
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

async function renderList(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.read");
  const type = ctx.url.searchParams.get("type") ?? undefined;
  const search = ctx.url.searchParams.get("q") ?? undefined;
  const assets = await listAssets(ctx.db, { type, search });

  const body = html`
    <h1>Equipment</h1>
    <p class="lede">Tap a machine to file today's pre-use inspection.</p>

    <form method="get" action="/equipment">
      <label for="q">Search by tag, serial, VIN, or model</label>
      <input id="q" name="q" value="${search ?? ""}" inputmode="search" autocomplete="off">
      ${type ? html`<input type="hidden" name="type" value="${type}">` : ""}
      <div class="btn-row"><button type="submit">Search</button></div>
    </form>

    ${tabs([
      { href: "/equipment", label: "All", current: !type },
      ...ASSET_TYPES.map((value) => ({
        href: `/equipment${query({ type: value, q: search })}`,
        label: ASSET_TYPE_LABELS[value],
        current: type === value,
      })),
    ])}

    ${assets.length === 0
      ? empty("No equipment matches that.")
      : assets.map(
          (asset) => html`<a class="card" href="/equipment/${asset.asset_tag}">
            <div class="row">
              <h3>${asset.asset_tag} · ${asset.manufacturer ?? ""} ${asset.model ?? ""}</h3>
              ${badge(asset.status, asset.status === "out_of_service" ? "bad" : asset.status === "available" ? "ok" : "")}
            </div>
            <div class="meta">
              ${ASSET_TYPE_LABELS[asset.asset_type as AssetType] ?? asset.asset_type}
              ${asset.hour_meter != null ? ` · ${asset.hour_meter} h` : ""}
              ${asset.odometer != null ? ` · ${asset.odometer.toLocaleString("en-US")} mi` : ""}
              ${asset.open_defect_count > 0 ? ` · ${asset.open_defect_count} open defect${asset.open_defect_count === 1 ? "" : "s"}` : ""}
              · last checked ${formatDate(asset.last_inspected_at)}
            </div>
            ${asset.verification_status && asset.verification_status !== "verified" ? html`<p>${badge("needs source verification", "warn")}</p>` : ""}
          </a>`,
        )}

    ${can(ctx.actor, "asset.write") ? html`<div class="btn-row"><a class="btn secondary" href="/equipment/new">Add equipment</a></div>` : ""}
  `;
  return page(body, { title: "Equipment", actor: ctx.actor, section: "/equipment", unread: 0, flash: flashFrom(ctx.url) });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.read");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const today = await todaysInspection(ctx.db, asset.id, ctx.actor.employeeId);
  const schedules = await serviceSchedulesFor(ctx.db, asset);
  const inspections = await listInspections(ctx.db, { assetId: asset.id, limit: 10 });
  const defects = await listDefects(ctx.db, { assetId: asset.id, openOnly: true });
  const services = await listServiceRecords(ctx.db, asset.id, 10);
  const documents = await listDocuments(ctx.db, { assetId: asset.id });
  const link = await getLink(ctx.db, "asset", asset.id);
  const sourceMetadata = await assetSourceMetadata(ctx.db, asset.id);
  const employees = sourceMetadata && can(ctx.actor, "asset.write") ? await listEmployees(ctx.db) : [];

  const body = html`
    <h1>${asset.asset_tag}</h1>
    <p class="lede">${asset.manufacturer ?? ""} ${asset.model ?? ""} ${asset.model_year ?? ""} ·
      ${ASSET_TYPE_LABELS[asset.asset_type as AssetType] ?? asset.asset_type}</p>

    <div class="card">
      <div class="row">
        ${badge(asset.status, asset.status === "out_of_service" ? "bad" : asset.status === "available" ? "ok" : "")}
        ${today ? badge("checked today", "ok") : badge("not checked today", "warn")}
      </div>
      ${asset.out_of_service_reason ? html`<p class="meta">${asset.out_of_service_reason}</p>` : ""}
      ${kv([
        ["Serial", asset.serial_number],
        ["VIN", asset.vin],
        ["Plate", asset.plate_number],
        ["Hours", asset.hour_meter],
        ["Odometer", asset.odometer?.toLocaleString("en-US")],
        ["Home base", asset.home_base],
        ["Monday item", link ? `${link.monday_item_id} (${link.sync_state})` : "not linked"],
        ["Canonical key", assetCanonicalKey(asset)],
      ])}
      <div class="btn-row">
        ${asset.status === "retired"
          ? ""
          : html`<a class="btn" href="/equipment/${asset.asset_tag}/inspect">${today ? "View today's check" : "Pre-use inspection"}</a>`}
        <a class="btn secondary" href="/repairs/new?assetId=${asset.id}">Report a repair</a>
      </div>
    </div>

    ${sourceMetadata
      ? html`<h2>Fleet record verification</h2>
          <div class="card">
            <div class="row"><h3>Imported from ${sourceMetadata.source_file}</h3>
              ${badge(sourceMetadata.verification_status, sourceMetadata.verification_status === "verified" ? "ok" : "warn")}</div>
            <p class="meta">Source row: ${sourceMetadata.source_reference} · imported ${formatDate(sourceMetadata.imported_at)}</p>
            ${sourceMetadata.source_notes ? html`<p>${sourceMetadata.source_notes}</p>` : ""}
            ${sourceMetadata.verification_status === "verified"
              ? html`<p class="meta">Resolved ${formatDate(sourceMetadata.resolved_at)}${sourceMetadata.resolved_by_name ? ` by ${sourceMetadata.resolved_by_name}` : ""}${sourceMetadata.resolution_notes ? ` · ${sourceMetadata.resolution_notes}` : ""}</p>`
              : can(ctx.actor, "asset.write")
                ? html`<form method="post" action="/api/equipment/${asset.asset_tag}/source-verification">
                    <p class="meta">Confirm the record below, then document what you checked. The original import note stays on file.</p>
                    <label for="serial_number">Confirmed serial number</label>
                    <input id="serial_number" name="serial_number" value="${asset.serial_number ?? ""}">
                    <label for="vin">Confirmed VIN</label>
                    <input id="vin" name="vin" value="${asset.vin ?? ""}">
                    <label for="model">Confirmed model</label>
                    <input id="model" name="model" value="${asset.model ?? ""}">
                    <label for="assigned_to">Assigned operator (if now known)</label>
                    <select id="assigned_to" name="assigned_to">
                      <option value="">Not assigned</option>
                      ${employees.map((person) => html`<option value="${person.id}" ${raw(person.id === asset.assigned_to ? "selected" : "")}>${person.display_name}</option>`)}
                    </select>
                    <label for="resolution_notes">How was this verified?</label>
                    <textarea id="resolution_notes" name="resolution_notes" required placeholder="Example: VIN confirmed from registration on 2026-08-23."></textarea>
                    <div class="btn-row"><button type="submit">Mark verified</button></div>
                  </form>`
                : html`<p class="meta">A supervisor or admin must review this imported-source flag.</p>`}
          </div>`
      : ""}

    ${defects.length > 0
      ? html`<h2>Open defects</h2>
          ${defects.map(
            (defect) => html`<div class="card">
              <div class="row"><h3>${defect.summary}</h3>${badge(defect.severity, defect.severity === "critical" ? "bad" : "warn")}</div>
              <p class="meta">${formatDate(defect.created_at)} · ${defect.reported_by_name}${defect.ticket_number ? ` · ${defect.ticket_number}` : ""}</p>
              ${defect.detail ? html`<p>${defect.detail}</p>` : ""}
              ${defect.repair_ticket_id
                ? html`<a href="/repairs/${defect.repair_ticket_id}">Open ticket</a>`
                : html`<a class="btn secondary" href="/repairs/new?assetId=${asset.id}&defectId=${defect.id}">Open a ticket</a>`}
            </div>`,
          )}`
      : ""}

    <h2>Service</h2>
    ${schedules.length === 0
      ? empty("No service intervals set for this machine.")
      : schedules.map(
          (schedule) => html`<div class="card">
            <div class="row"><h3>${schedule.description}</h3>
              ${schedule.overdue ? badge("overdue", "bad") : schedule.due ? badge("due soon", "warn") : badge("ok", "ok")}</div>
            <div class="meta">${describeServiceDue(schedule)} · last ${formatDate(schedule.last_service_at)}</div>
          </div>`,
        )}

    ${can(ctx.actor, "asset.service.record")
      ? html`<details class="card">
          <summary><strong>Record service</strong></summary>
          <form method="post" action="/api/equipment/${asset.asset_tag}/service">
            <label for="schedule_id">Interval</label>
            <select id="schedule_id" name="schedule_id">
              <option value="">Unscheduled work</option>
              ${schedules.map((schedule) => html`<option value="${schedule.id}">${schedule.description}</option>`)}
            </select>
            <label for="service_type">Type</label>
            <select id="service_type" name="service_type">
              <option value="preventive">Preventive</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
            <label for="description">What was done</label>
            <textarea id="description" name="description" required></textarea>
            <label for="vendor">Vendor (if outside)</label>
            <input id="vendor" name="vendor">
            <label for="hour_meter">Hour meter</label>
            <input id="hour_meter" name="hour_meter" inputmode="decimal">
            <label for="odometer">Odometer</label>
            <input id="odometer" name="odometer" inputmode="numeric">
            <label for="cost">Cost (USD)</label>
            <input id="cost" name="cost" inputmode="decimal">
            <div class="btn-row"><button type="submit">Save service record</button></div>
          </form>
        </details>
        <details class="card">
          <summary><strong>Add a service interval</strong></summary>
          <form method="post" action="/api/equipment/${asset.asset_tag}/schedules">
            <label for="service_key">Key</label>
            <input id="service_key" name="service_key" placeholder="engine_oil" required>
            <label for="sched_description">Description</label>
            <input id="sched_description" name="description" required>
            <label for="interval_hours">Every (hours)</label>
            <input id="interval_hours" name="interval_hours" inputmode="decimal">
            <label for="interval_miles">Every (miles)</label>
            <input id="interval_miles" name="interval_miles" inputmode="numeric">
            <label for="interval_days">Every (days)</label>
            <input id="interval_days" name="interval_days" inputmode="numeric">
            <div class="btn-row"><button type="submit">Add interval</button></div>
          </form>
        </details>`
      : ""}

    ${services.length > 0
      ? html`<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Work</th><th>By</th><th>Meter</th><th>Cost</th></tr></thead>
          <tbody>${services.map(
            (record) => html`<tr>
              <td>${formatDate(record.performed_at)}</td>
              <td>${record.description}${record.vendor ? html`<br><span class="meta">${record.vendor}</span>` : ""}</td>
              <td>${record.performed_by_name ?? "—"}</td>
              <td>${record.hour_meter ?? record.odometer ?? "—"}</td>
              <td>${money(record.cost_cents)}</td>
            </tr>`,
          )}</tbody></table></div>`
      : ""}

    <h2>Inspection history</h2>
    ${inspections.length === 0
      ? empty("No inspections filed yet.")
      : inspections.map(
          (inspection) => html`<a class="card" href="/inspections/${inspection.id}">
            <div class="row"><h3>${formatDate(inspection.performed_at)}</h3>
              ${badge(inspection.status, inspection.status === "passed" ? "ok" : "warn")}</div>
            <div class="meta">${inspection.performed_by_name}
              ${inspection.meter_reading != null ? ` · ${inspection.meter_reading} h` : ""}
              ${inspection.odometer != null ? ` · ${inspection.odometer.toLocaleString("en-US")} mi` : ""}
              ${inspection.defect_count > 0 ? ` · ${inspection.defect_count} defect(s)` : ""}</div>
          </a>`,
        )}

    <h2>Photos and documents</h2>
    ${documentList(documents)}
    ${uploadForm(ctx.actor, { assetId: asset.id }, `/equipment/${asset.asset_tag}`)}

    ${can(ctx.actor, "asset.write")
      ? html`<details class="card">
          <summary><strong>Change status</strong></summary>
          <form method="post" action="/api/equipment/${asset.asset_tag}/status">
            <label for="status">Status</label>
            <select id="status" name="status">
              <option value="available">Available</option>
              <option value="in_use">In use</option>
              <option value="out_of_service">Out of service</option>
              <option value="retired">Retired</option>
            </select>
            <label for="reason">Reason (required when taking it out of service)</label>
            <input id="reason" name="reason">
            <div class="btn-row"><button type="submit">Update</button></div>
          </form>
        </details>`
      : ""}
  `;

  return page(body, {
    title: asset.asset_tag,
    actor: ctx.actor,
    section: "/equipment",
    back: { href: "/equipment", label: "Equipment" },
    flash: flashFrom(ctx.url),
  });
}

async function resolveSourceVerificationRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const fields = await readFields(ctx.request);
  await resolveAssetVerification(ctx.db, {
    assetId: asset.id,
    serialNumber: optionalField(fields, "serial_number"),
    vin: optionalField(fields, "vin"),
    model: optionalField(fields, "model"),
    assignedTo: optionalField(fields, "assigned_to"),
    resolutionNotes: requiredField(fields, "resolution_notes", "Verification note"),
    resolvedBy: ctx.actor.employeeId,
  });
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/equipment/${asset.asset_tag}?ok=source_verified`);
}

async function renderInspectionForm(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inspection.submit");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const existing = await todaysInspection(ctx.db, asset.id, ctx.actor.employeeId);
  if (existing) return redirect(`/inspections/${existing.id}`);

  const template = await templateForAssetType(ctx.db, asset.asset_type);
  const body = html`
    <h1>${template.name}</h1>
    <p class="lede">${asset.asset_tag} · ${asset.manufacturer ?? ""} ${asset.model ?? ""}</p>

    <form method="post" action="/api/inspections">
      <input type="hidden" name="template_key" value="${template.template_key}">
      <input type="hidden" name="asset_id" value="${asset.id}">
      <input type="hidden" name="redirect_to" value="/equipment/${asset.asset_tag}">

      ${template.meter_prompt === "hours"
        ? html`<fieldset><legend>Hour meter</legend>
            <label for="meter_reading">Reading now (last recorded ${asset.hour_meter ?? "—"})</label>
            <input id="meter_reading" name="meter_reading" inputmode="decimal" required></fieldset>`
        : ""}
      ${template.meter_prompt === "miles"
        ? html`<fieldset><legend>Odometer</legend>
            <label for="odometer">Reading now (last recorded ${asset.odometer?.toLocaleString("en-US") ?? "—"})</label>
            <input id="odometer" name="odometer" inputmode="numeric" required></fieldset>`
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

      <div class="btn-row"><button type="submit">File inspection</button></div>
    </form>
  `;
  return page(body, {
    title: "Pre-use inspection",
    actor: ctx.actor,
    section: "/equipment",
    back: { href: `/equipment/${asset.asset_tag}`, label: asset.asset_tag },
  });
}

export async function renderInspection(ctx: RequestContext): Promise<Response> {
  const inspection = await getInspection(ctx.db, ctx.params.id);
  if (!inspection) throw notFound("Inspection not found");
  const documents = await listDocuments(ctx.db, { inspectionId: inspection.id });

  const body = html`
    <h1>${inspection.template_name ?? inspection.inspection_kind.replace(/_/g, " ")}</h1>
    <p class="lede">${formatDate(inspection.performed_at)} · ${inspection.performed_by_name}</p>

    <div class="card">
      <div class="row">${badge(inspection.status, inspection.status === "passed" ? "ok" : "warn")}</div>
      ${kv([
        ["Hour meter", inspection.meter_reading],
        ["Odometer", inspection.odometer?.toLocaleString("en-US")],
        ["Notes", inspection.notes],
      ])}
    </div>

    ${inspection.fields.length > 0
      ? html`<h2>Report details</h2><div class="card">${kv(inspection.fields.map((field) => [field.label, field.value]))}</div>`
      : ""}

    <h2>Checklist</h2>
    <div class="card">
      ${inspection.answers.map(
        (answer) => html`<div class="check-row">
          <div class="q">${answer.question}${answer.notes ? html`<br><span class="meta">${answer.notes}</span>` : ""}</div>
          ${badge(answer.result === "not_applicable" ? "N/A" : answer.result, answer.result === "fail" ? "bad" : answer.result === "pass" ? "ok" : "")}
        </div>`,
      )}
    </div>

    <h2>Photos</h2>
    ${documentList(documents)}
    ${uploadForm(ctx.actor, { inspectionId: inspection.id }, `/inspections/${inspection.id}`)}
  `;
  return page(body, {
    title: "Inspection",
    actor: ctx.actor,
    section: inspection.asset_id ? "/equipment" : "/homes",
    back: inspection.asset_id
      ? { href: `/equipment/${inspection.asset_id}`, label: "Machine" }
      : { href: `/homes/${inspection.home_id}`, label: "Home" },
    flash: flashFrom(ctx.url),
  });
}

async function renderNewAsset(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const body = html`
    <h1>Add equipment</h1>
    <p class="lede">Every machine needs a serial number or a VIN — that is the key the Monday board syncs on.</p>
    <form method="post" action="/api/equipment">
      <input type="hidden" name="redirect_to" value="/equipment">
      <label for="asset_tag">Asset tag</label>
      <input id="asset_tag" name="asset_tag" required placeholder="EX-03">
      <label for="asset_type">Type</label>
      <select id="asset_type" name="asset_type">
        ${ASSET_TYPES.map((value) => html`<option value="${value}">${ASSET_TYPE_LABELS[value]}</option>`)}
      </select>
      <label for="manufacturer">Make</label>
      <input id="manufacturer" name="manufacturer">
      <label for="model">Model</label>
      <input id="model" name="model">
      <label for="model_year">Year</label>
      <input id="model_year" name="model_year" inputmode="numeric">
      <label for="serial_number">Serial number</label>
      <input id="serial_number" name="serial_number" autocapitalize="characters">
      <label for="vin">VIN (road equipment)</label>
      <input id="vin" name="vin" autocapitalize="characters">
      <label for="plate_number">Plate</label>
      <input id="plate_number" name="plate_number">
      <label for="hour_meter">Hour meter</label>
      <input id="hour_meter" name="hour_meter" inputmode="decimal">
      <label for="odometer">Odometer</label>
      <input id="odometer" name="odometer" inputmode="numeric">
      <label for="home_base">Home base</label>
      <input id="home_base" name="home_base">
      <div class="btn-row"><button type="submit">Add equipment</button></div>
    </form>
  `;
  return page(body, { title: "Add equipment", actor: ctx.actor, section: "/equipment", back: { href: "/equipment", label: "Equipment" } });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createAssetRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const fields = await readFields(ctx.request);
  const assetType = requiredField(fields, "asset_type", "Type") as AssetType;
  const id = await createAsset(ctx.db, {
    assetTag: requiredField(fields, "asset_tag", "Asset tag"),
    assetType,
    manufacturer: optionalField(fields, "manufacturer"),
    model: optionalField(fields, "model"),
    modelYear: numberField(fields, "model_year", "Year"),
    serialNumber: optionalField(fields, "serial_number"),
    vin: optionalField(fields, "vin"),
    plateNumber: optionalField(fields, "plate_number"),
    hourMeter: numberField(fields, "hour_meter", "Hour meter"),
    odometer: numberField(fields, "odometer", "Odometer"),
    homeBase: optionalField(fields, "home_base"),
  });
  const asset = await requireAsset(ctx.db, id);
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/equipment/${asset.asset_tag}?ok=saved`);
}

async function setStatusRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const fields = await readFields(ctx.request);
  await setAssetStatus(ctx.db, asset.id, requiredField(fields, "status", "Status"), optionalField(fields, "reason"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/equipment/${asset.asset_tag}?ok=saved`);
}

async function recordServiceRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.service.record");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const fields = await readFields(ctx.request);
  const serviceType = (optionalField(fields, "service_type") ?? "preventive") as "preventive" | "repair" | "inspection" | "other";
  const id = await recordService(ctx.db, {
    assetId: asset.id,
    scheduleId: optionalField(fields, "schedule_id"),
    serviceType,
    description: requiredField(fields, "description", "Description"),
    vendor: optionalField(fields, "vendor"),
    hourMeter: numberField(fields, "hour_meter", "Hour meter"),
    odometer: numberField(fields, "odometer", "Odometer"),
    costCents: centsField(fields, "cost", "Cost"),
    performedBy: ctx.actor.employeeId,
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/equipment/${asset.asset_tag}?ok=saved`);
}

async function createScheduleRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const asset = await requireAsset(ctx.db, ctx.params.tag);
  const fields = await readFields(ctx.request);
  const id = await createServiceSchedule(ctx.db, {
    assetId: asset.id,
    serviceKey: requiredField(fields, "service_key", "Key"),
    description: requiredField(fields, "description", "Description"),
    intervalHours: numberField(fields, "interval_hours", "Interval hours"),
    intervalMiles: numberField(fields, "interval_miles", "Interval miles"),
    intervalDays: numberField(fields, "interval_days", "Interval days"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/equipment/${asset.asset_tag}?ok=saved`);
}

async function submitInspectionRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "inspection.submit");
  const contentType = ctx.request.headers.get("Content-Type") ?? "";

  let templateKey: string;
  let answers: AnswerInput[];
  let fieldEntries: { key: string; label: string; value: string | null }[] = [];
  let assetId: string | null;
  let homeId: string | null;
  let meterReading: number | null;
  let odometer: number | null;
  let notes: string | null;
  let redirectTo: string | null;

  if (contentType.includes("application/json")) {
    const parsed = (await ctx.request.json()) as {
      template_key?: string;
      asset_id?: string;
      home_id?: string;
      meter_reading?: number;
      odometer?: number;
      notes?: string;
      answers?: { checklist_key: string; result: AnswerResult; notes?: string }[];
      fields?: { key: string; label: string; value: string }[];
    };
    templateKey = parsed.template_key ?? "";
    assetId = parsed.asset_id ?? null;
    homeId = parsed.home_id ?? null;
    meterReading = parsed.meter_reading ?? null;
    odometer = parsed.odometer ?? null;
    notes = parsed.notes ?? null;
    redirectTo = null;
    answers = (parsed.answers ?? []).map((answer) => ({
      checklistKey: answer.checklist_key,
      result: answer.result,
      notes: answer.notes ?? null,
    }));
    fieldEntries = (parsed.fields ?? []).map((field) => ({ key: field.key, label: field.label, value: field.value }));
  } else {
    const form = await readForm(ctx.request);
    templateKey = String(form.get("template_key") ?? "");
    assetId = (form.get("asset_id") as string) || null;
    homeId = (form.get("home_id") as string) || null;
    meterReading = form.get("meter_reading") ? Number(form.get("meter_reading")) : null;
    odometer = form.get("odometer") ? Number(form.get("odometer")) : null;
    notes = (form.get("notes") as string) || null;
    redirectTo = (form.get("redirect_to") as string) || null;

    answers = [];
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("answer_") || typeof value !== "string") continue;
      const checklistKey = key.slice("answer_".length);
      answers.push({
        checklistKey,
        result: value as AnswerResult,
        notes: (form.get(`note_${checklistKey}`) as string) || null,
      });
    }
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("field_") || typeof value !== "string") continue;
      const fieldKey = key.slice("field_".length);
      fieldEntries.push({ key: fieldKey, label: (form.get(`label_${fieldKey}`) as string) || fieldKey, value });
    }
  }

  if (!templateKey) throw badRequest("Which checklist is this?");

  const result = await submitInspection(ctx.db, ctx.actor, {
    templateKey,
    assetId,
    homeId,
    meterReading,
    odometer,
    notes,
    answers,
    fields: fieldEntries,
  });

  if (wantsJson(ctx)) return json(result, 201);
  const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : `/inspections/${result.inspectionId}`;
  return redirect(`${target}?ok=${result.status === "passed" ? "inspection_passed" : "inspection_defects"}`);
}

export function wantsJson(ctx: RequestContext): boolean {
  const accept = ctx.request.headers.get("Accept") ?? "";
  const contentType = ctx.request.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json") || (accept.includes("application/json") && !accept.includes("text/html"));
}
