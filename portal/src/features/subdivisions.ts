/**
 * Subdivisions and lots: directions, plats, permits, and the paperwork folder.
 *
 * "Subdivision" is the word Home Placer uses for a placement — one private lot
 * or a whole phase. The database still calls the table `jobs` (see
 * domain/jobs.ts); renaming a table adds risk without adding meaning, so the
 * rename stops at the surface. `/jobs` and `/api/jobs` stay registered as
 * aliases so an old bookmark or a saved script keeps working.
 */
import { assertCan, can } from "../auth/authz.ts";
import { listDocuments } from "../domain/documents.ts";
import { listHomes } from "../domain/homes.ts";
import { createJob, createLot, listJobs, listLots, requireJob, updateLotStatus } from "../domain/jobs.ts";
import { listSupervisors } from "../domain/employees.ts";
import { listTasks } from "../domain/tasks.ts";
import { getLink } from "../integrations/monday.ts";
import { numberField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, query } from "../ui/html.ts";
import { badge, empty, externalLink, formatDate, kv, page, tabs } from "../ui/layout.ts";
import { documentList, uploadForm } from "./documents.ts";
import { wantsJson } from "./equipment.ts";

const JOB_STATUSES = ["planning", "active", "on_hold", "complete", "archived"];
const LOT_STATUSES = ["pending", "permitted", "prepped", "set", "complete"];

export function registerSubdivisions(router: Router): void {
  for (const prefix of ["/subdivisions", "/jobs"]) {
    router.get(prefix, renderList);
    router.get(`${prefix}/new`, renderNewSubdivision);
    router.get(`${prefix}/:id`, renderDetail);
    router.post(`/api${prefix}`, createSubdivisionRoute);
    router.post(`/api${prefix}/:id/lots`, createLotRoute);
  }
  router.post("/api/lots/:id/status", updateLotStatusRoute);

  for (const prefix of ["/api/subdivisions", "/api/jobs"]) {
    router.get(prefix, async (ctx) => {
      assertCan(ctx.actor, "job.read");
      const subdivisions = await listJobs(ctx.db, {
        status: ctx.url.searchParams.get("status") ?? undefined,
        search: ctx.url.searchParams.get("q") ?? undefined,
      });
      // `jobs` is kept alongside `subdivisions` so existing callers do not break.
      return json({ subdivisions, jobs: subdivisions });
    });
  }
}

async function renderList(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "job.read");
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const search = ctx.url.searchParams.get("q") ?? undefined;
  const jobs = await listJobs(ctx.db, { status, search });

  const body = html`
    <h1>Subdivisions</h1>
    <form method="get" action="/subdivisions">
      <label for="q">Search subdivision number, title, or town</label>
      <input id="q" name="q" value="${search ?? ""}" inputmode="search" autocomplete="off">
      <div class="btn-row"><button type="submit">Search</button></div>
    </form>

    ${tabs([
      { href: "/subdivisions", label: "All", current: !status },
      ...JOB_STATUSES.map((value) => ({
        href: `/subdivisions${query({ status: value, q: search })}`,
        label: value.replace(/_/g, " "),
        current: status === value,
      })),
    ])}

    ${jobs.length === 0
      ? empty("No subdivisions match that.")
      : jobs.map(
          (job) => html`<a class="card" href="/subdivisions/${job.id}">
            <div class="row"><h3>${job.job_number} — ${job.title}</h3>${badge(job.status, job.status === "active" ? "ok" : "")}</div>
            <div class="meta">${[job.city, job.state].filter(Boolean).join(", ")}
              · ${job.lot_count} lot${job.lot_count === 1 ? "" : "s"} · ${job.home_count} home${job.home_count === 1 ? "" : "s"}
              ${job.open_task_count > 0 ? ` · ${job.open_task_count} open task(s)` : ""}
              ${job.supervisor_name ? ` · ${job.supervisor_name}` : ""}</div>
          </a>`,
        )}

    ${can(ctx.actor, "subdivision.create") ? html`<div class="btn-row"><a class="btn secondary" href="/subdivisions/new">New subdivision</a></div>` : ""}
  `;
  return page(body, { title: "Subdivisions", actor: ctx.actor, section: "/subdivisions", flash: flashFrom(ctx.url) });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "job.read");
  const job = await requireJob(ctx.db, ctx.params.id);
  const lots = await listLots(ctx.db, job.id);
  const homes = await listHomes(ctx.db, { jobId: job.id });
  const tasks = await listTasks(ctx.db, ctx.actor, { jobId: job.id, openOnly: true });
  const documents = await listDocuments(ctx.db, { jobId: job.id });
  const link = await getLink(ctx.db, "job", job.id);

  const body = html`
    <h1>${job.job_number}</h1>
    <p class="lede">${job.title}</p>

    <div class="card">
      <div class="row">${badge(job.status, job.status === "active" ? "ok" : "")}</div>
      ${kv([
        ["Address", [job.street_address, job.city, job.state, job.postal_code].filter(Boolean).join(", ")],
        ["Map", externalLink(job.google_maps_url, "Open in Google Maps")],
        ["Drive folder", externalLink(job.drive_folder_url, "Subdivision folder")],
        ["Customer ref", job.customer_reference],
        ["Monday item", link ? `${link.monday_item_id} (${link.sync_state})` : "not linked"],
        ["Notes", job.notes],
      ])}
    </div>

    <h2>Lots</h2>
    ${lots.length === 0
      ? empty("No lots in this subdivision yet.")
      : lots.map(
          (lot) => html`<div class="card">
            <div class="row"><h3>Lot ${lot.lot_number}</h3>${badge(lot.status, lot.status === "complete" ? "ok" : "")}</div>
            ${kv([
              ["Address", [lot.street_address, lot.city, lot.state].filter(Boolean).join(", ")],
              ["Parcel", lot.parcel_id],
              ["Map", externalLink(lot.google_maps_url, "Directions")],
              ["Plat", externalLink(lot.plat_drive_url, "Plat")],
              ["Permit", externalLink(lot.permit_drive_url, "Permit")],
              ["Access", lot.access_notes],
              ["Utilities", lot.utility_notes],
            ])}
            ${can(ctx.actor, "lot.write")
              ? html`<form method="post" action="/api/lots/${lot.id}/status">
                  <label for="status-${lot.id}">Lot status</label>
                  <select id="status-${lot.id}" name="status">
                    ${LOT_STATUSES.map((value) => html`<option value="${value}" ${value === lot.status ? html`selected` : ""}>${value}</option>`)}
                  </select>
                  <div class="btn-row"><button class="secondary" type="submit">Update lot</button></div>
                </form>`
              : ""}
          </div>`,
        )}

    ${can(ctx.actor, "lot.write")
      ? html`<details class="card">
          <summary><strong>Add a lot</strong></summary>
          <form method="post" action="/api/subdivisions/${job.id}/lots">
            <label for="lot_number">Lot number</label>
            <input id="lot_number" name="lot_number" required>
            <label for="parcel_id">Parcel id</label>
            <input id="parcel_id" name="parcel_id">
            <label for="street_address">Address</label>
            <input id="street_address" name="street_address">
            <label for="latitude">Latitude</label>
            <input id="latitude" name="latitude" inputmode="decimal">
            <label for="longitude">Longitude</label>
            <input id="longitude" name="longitude" inputmode="decimal">
            <label for="google_maps_url">Google Maps link (or leave blank to build one from the coordinates)</label>
            <input id="google_maps_url" name="google_maps_url" inputmode="url">
            <label for="plat_drive_url">Plat — Google Drive link</label>
            <input id="plat_drive_url" name="plat_drive_url" inputmode="url">
            <label for="permit_drive_url">Permit — Google Drive link</label>
            <input id="permit_drive_url" name="permit_drive_url" inputmode="url">
            <label for="access_notes">Access notes</label>
            <textarea id="access_notes" name="access_notes"></textarea>
            <label for="utility_notes">Utility notes</label>
            <textarea id="utility_notes" name="utility_notes"></textarea>
            <div class="btn-row"><button type="submit">Add lot</button></div>
          </form>
        </details>`
      : ""}

    <h2>Homes</h2>
    ${homes.length === 0
      ? empty("No homes assigned to this subdivision.")
      : homes.map(
          (home) => html`<a class="card" href="/homes/${home.id}">
            <div class="row"><h3>${home.serial_number}</h3>${badge(home.status, home.status === "complete" ? "ok" : "")}</div>
            <div class="meta">${home.manufacturer ?? ""} ${home.model ?? ""}${home.lot_number ? ` · lot ${home.lot_number}` : ""}</div>
          </a>`,
        )}

    <h2>Open tasks</h2>
    ${tasks.length === 0
      ? empty("Nothing open in this subdivision.")
      : tasks.map(
          (task) => html`<a class="card" href="/tasks/${task.id}">
            <div class="row"><h3>${task.title}</h3>${badge(task.status)}</div>
            <div class="meta">${task.assignee_name ?? "Unassigned"}${task.due_at ? ` · due ${formatDate(task.due_at)}` : ""}</div>
          </a>`,
        )}

    <h2>Subdivision documents</h2>
    ${documentList(documents)}
    ${uploadForm(ctx.actor, { jobId: job.id }, `/jobs/${job.id}`)}
  `;

  return page(body, {
    title: job.job_number,
    actor: ctx.actor,
    section: "/subdivisions",
    back: { href: "/subdivisions", label: "Subdivisions" },
    flash: flashFrom(ctx.url),
  });
}

async function renderNewSubdivision(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "subdivision.create");
  const supervisors = await listSupervisors(ctx.db);
  const body = html`
    <h1>New subdivision</h1>
    <form method="post" action="/api/subdivisions">
      <label for="job_number">Subdivision number</label>
      <input id="job_number" name="job_number" required placeholder="HP-2610">
      <label for="title">Title</label>
      <input id="title" name="title" required>
      <label for="status">Status</label>
      <select id="status" name="status">${JOB_STATUSES.map((value) => html`<option value="${value}" ${value === "active" ? html`selected` : ""}>${value}</option>`)}</select>
      <label for="street_address">Address</label>
      <input id="street_address" name="street_address">
      <label for="city">City</label>
      <input id="city" name="city">
      <label for="state">State</label>
      <input id="state" name="state" maxlength="2">
      <label for="postal_code">ZIP</label>
      <input id="postal_code" name="postal_code" inputmode="numeric">
      <label for="google_maps_url">Google Maps link</label>
      <input id="google_maps_url" name="google_maps_url" inputmode="url">
      <label for="drive_folder_url">Google Drive job folder</label>
      <input id="drive_folder_url" name="drive_folder_url" inputmode="url">
      <label for="supervisor_id">Supervisor</label>
      <select id="supervisor_id" name="supervisor_id">
        <option value="">Unassigned</option>
        ${supervisors.map((person) => html`<option value="${person.id}">${person.display_name}</option>`)}
      </select>
      <label for="notes">Notes</label>
      <textarea id="notes" name="notes"></textarea>
      <div class="btn-row"><button type="submit">Create subdivision</button></div>
    </form>
  `;
  return page(body, { title: "New subdivision", actor: ctx.actor, section: "/subdivisions", back: { href: "/subdivisions", label: "Subdivisions" } });
}

async function createSubdivisionRoute(ctx: RequestContext): Promise<Response> {
  // Naming a new subdivision is field work; editing lots and statuses is not.
  assertCan(ctx.actor, "subdivision.create");
  const fields = await readFields(ctx.request);
  const id = await createJob(ctx.db, {
    jobNumber: requiredField(fields, "job_number", "Subdivision number"),
    title: requiredField(fields, "title", "Title"),
    status: optionalField(fields, "status") ?? "active",
    streetAddress: optionalField(fields, "street_address"),
    city: optionalField(fields, "city"),
    state: optionalField(fields, "state"),
    postalCode: optionalField(fields, "postal_code"),
    googleMapsUrl: optionalField(fields, "google_maps_url"),
    driveFolderUrl: optionalField(fields, "drive_folder_url"),
    supervisorId: optionalField(fields, "supervisor_id"),
    customerReference: optionalField(fields, "customer_reference"),
    notes: optionalField(fields, "notes"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/subdivisions/${id}?ok=saved`);
}

async function createLotRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "lot.write");
  const job = await requireJob(ctx.db, ctx.params.id);
  const fields = await readFields(ctx.request);
  const id = await createLot(ctx.db, {
    jobId: job.id,
    lotNumber: requiredField(fields, "lot_number", "Lot number"),
    parcelId: optionalField(fields, "parcel_id"),
    streetAddress: optionalField(fields, "street_address"),
    city: optionalField(fields, "city") ?? job.city,
    state: optionalField(fields, "state") ?? job.state,
    postalCode: optionalField(fields, "postal_code") ?? job.postal_code,
    latitude: numberField(fields, "latitude", "Latitude"),
    longitude: numberField(fields, "longitude", "Longitude"),
    googleMapsUrl: optionalField(fields, "google_maps_url"),
    platDriveUrl: optionalField(fields, "plat_drive_url"),
    permitDriveUrl: optionalField(fields, "permit_drive_url"),
    accessNotes: optionalField(fields, "access_notes"),
    utilityNotes: optionalField(fields, "utility_notes"),
  });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/subdivisions/${job.id}?ok=saved`);
}

async function updateLotStatusRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "lot.write");
  const fields = await readFields(ctx.request);
  await updateLotStatus(ctx.db, ctx.params.id, requiredField(fields, "status", "Status"));
  if (wantsJson(ctx)) return json({ ok: true });
  const lot = await ctx.db.prepare("SELECT job_id FROM lots WHERE id = ?").bind(ctx.params.id).first<{ job_id: string }>();
  return redirect(`/subdivisions/${lot?.job_id ?? ""}?ok=saved`);
}
