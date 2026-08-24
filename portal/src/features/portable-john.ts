import { can } from "../auth/authz.ts";
import { listAssets } from "../domain/assets.ts";
import { listHomes } from "../domain/homes.ts";
import { listJobs } from "../domain/jobs.ts";
import { createPortableJohnRequest, listPortableJohnRequests, PORTABLE_JOHN_STATUSES, requirePortableJohnRequest, updatePortableJohnStatus, type PortableJohnStatus } from "../domain/portable-john.ts";
import { numberField, optionalField, readFields, requiredField, type RequestContext } from "../api/context.ts";
import { flashFrom, json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { html, raw } from "../ui/html.ts";
import { badge, empty, formatDate, kv, page, tabs } from "../ui/layout.ts";
import { wantsJson } from "./equipment.ts";

export function registerPortableJohn(router: Router): void {
  router.get("/portable-john", renderList);
  router.get("/portable-john/new", renderNew);
  router.get("/portable-john/:id", renderDetail);
  router.get("/api/portable-john", async (ctx) => json({ requests: await listPortableJohnRequests(ctx.db, ctx.actor, ctx.url.searchParams.get("status") ?? undefined) }));
  router.post("/api/portable-john", createRoute);
  router.post("/api/portable-john/:id/status", statusRoute);
}

async function renderList(ctx: RequestContext): Promise<Response> {
  const status = ctx.url.searchParams.get("status") ?? undefined;
  const requests = await listPortableJohnRequests(ctx.db, ctx.actor, status);
  const body = html`<h1>Portable John</h1>
    <p class="lede">Request a delivery or pickup and route the location to operations.</p>
    ${tabs([{ href: "/portable-john", label: "All", current: !status }, ...PORTABLE_JOHN_STATUSES.map((value) => ({ href: `/portable-john?status=${value}`, label: value, current: status === value }))])}
    ${requests.length ? requests.map((item) => html`<a class="card" href="/portable-john/${item.id}">
      <div class="row"><h3>${item.request_number} · ${item.request_type}</h3>${badge(item.status, item.status === "complete" ? "ok" : item.status === "requested" ? "warn" : "")}</div>
      <div class="meta">${targetLabel(item)} · ${item.quantity} unit${item.quantity === 1 ? "" : "s"}${item.requested_date ? ` · requested ${formatDate(item.requested_date)}` : ""} · ${item.requester_name}</div>
    </a>`) : empty("No Portable John requests here.")}
    <div class="btn-row"><a class="btn" href="/portable-john/new">Request delivery or pickup</a></div>`;
  return page(body, { title: "Portable John", actor: ctx.actor, section: "/portable-john", flash: flashFrom(ctx.url) });
}

async function renderNew(ctx: RequestContext): Promise<Response> {
  const [jobs, homes, assets] = await Promise.all([listJobs(ctx.db, { status: "active" }), listHomes(ctx.db), listAssets(ctx.db)]);
  const body = html`<h1>Portable John request</h1><p class="lede">Choose one related location, then give operations precise placement or pickup directions.</p>
    <form method="post" action="/api/portable-john">
      <label for="request_type">What do you need?</label><select id="request_type" name="request_type" required><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select>
      <label for="requested_date">Requested date</label><input id="requested_date" name="requested_date" type="date">
      <label for="quantity">Number of units</label><input id="quantity" name="quantity" type="number" min="1" max="25" value="1" required>
      <h2>Choose exactly one location</h2>
      <label for="job_id">Subdivision</label><select id="job_id" name="job_id"><option value="">None</option>${jobs.map((j) => html`<option value="${j.id}">${j.job_number} — ${j.title}</option>`)}</select>
      <label for="home_id">Home</label><select id="home_id" name="home_id"><option value="">None</option>${homes.map((h) => html`<option value="${h.id}">${h.serial_number}${h.site_address ? ` — ${h.site_address}` : ""}</option>`)}</select>
      <label for="asset_id">Equipment location</label><select id="asset_id" name="asset_id"><option value="">None</option>${assets.map((a) => html`<option value="${a.id}">${a.asset_tag} — ${[a.manufacturer, a.model].filter(Boolean).join(" ")}${a.home_base ? ` (${a.home_base})` : ""}</option>`)}</select>
      <label for="location_details">Exact placement or pickup location</label><textarea id="location_details" name="location_details" required placeholder="Gate, lot, landmark, access instructions, or current unit location"></textarea>
      <label for="notes">Anything else operations should know?</label><textarea id="notes" name="notes"></textarea>
      <div class="btn-row"><button type="submit">Send to operations</button></div>
    </form>`;
  return page(body, { title: "Portable John request", actor: ctx.actor, section: "/portable-john", back: { href: "/portable-john", label: "Portable John" } });
}

async function renderDetail(ctx: RequestContext): Promise<Response> {
  const item = await requirePortableJohnRequest(ctx.db, ctx.actor, ctx.params.id);
  const body = html`<h1>${item.request_number}</h1><p class="lede">${badge(item.request_type)} ${badge(item.status, item.status === "complete" ? "ok" : "warn")}</p>
    <div class="card">${kv([["Requested by", item.requester_name], ["Requested date", item.requested_date ? formatDate(item.requested_date) : "Next available"], ["Quantity", item.quantity], ["Related location", targetLabel(item)], ["Exact location", item.location_details], ["Notes", item.notes], ["Operations notes", item.operations_notes], ["Completed", item.completed_at ? formatDate(item.completed_at) : null]])}</div>
    ${can(ctx.actor, "task.assign") ? html`<h2>Operations</h2><form class="card" method="post" action="/api/portable-john/${item.id}/status">
      <label for="status">Status</label><select id="status" name="status">${PORTABLE_JOHN_STATUSES.map((s) => html`<option value="${s}" ${raw(s === item.status ? "selected" : "")}>${s}</option>`)}</select>
      <label for="operations_notes">Scheduling or completion notes</label><textarea id="operations_notes" name="operations_notes">${item.operations_notes ?? ""}</textarea>
      <div class="btn-row"><button type="submit">Update request</button></div></form>` : ""}`;
  return page(body, { title: "Portable John", actor: ctx.actor, section: "/portable-john", back: { href: "/portable-john", label: "Portable John" }, flash: flashFrom(ctx.url) });
}

async function createRoute(ctx: RequestContext): Promise<Response> {
  const fields = await readFields(ctx.request);
  const id = await createPortableJohnRequest(ctx.db, ctx.actor, { requestType: requiredField(fields, "request_type", "Request type"), requestedDate: optionalField(fields, "requested_date"), quantity: numberField(fields, "quantity", "Quantity") ?? 1, jobId: optionalField(fields, "job_id"), homeId: optionalField(fields, "home_id"), assetId: optionalField(fields, "asset_id"), locationDetails: requiredField(fields, "location_details", "Exact location"), notes: optionalField(fields, "notes") });
  return wantsJson(ctx) ? json({ id }, 201) : redirect(`/portable-john/${id}?ok=request_sent`);
}

async function statusRoute(ctx: RequestContext): Promise<Response> {
  const fields = await readFields(ctx.request);
  await updatePortableJohnStatus(ctx.db, ctx.actor, ctx.params.id, requiredField(fields, "status", "Status") as PortableJohnStatus, optionalField(fields, "operations_notes"));
  return wantsJson(ctx) ? json({ ok: true }) : redirect(`/portable-john/${ctx.params.id}?ok=saved`);
}

function targetLabel(item: { job_number: string | null; job_title: string | null; serial_number: string | null; site_address: string | null; asset_tag: string | null; asset_manufacturer: string | null; asset_model: string | null; asset_home_base: string | null }): string {
  if (item.job_number) return `${item.job_number}${item.job_title ? ` — ${item.job_title}` : ""}`;
  if (item.serial_number) return `${item.serial_number}${item.site_address ? ` — ${item.site_address}` : ""}`;
  const equipment = [item.asset_manufacturer, item.asset_model].filter(Boolean).join(" ");
  return `${item.asset_tag ?? "Equipment"}${equipment ? ` — ${equipment}` : ""}${item.asset_home_base ? ` (${item.asset_home_base})` : ""}`;
}
