/** Assign several shared fleet machines to one subdivision or one home. */
import { assertCan, can, type Actor } from "../auth/authz.ts";
import { readForm, type RequestContext } from "../api/context.ts";
import { json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { assignEquipmentToLocation, equipmentLocationName, listEquipmentAtLocation, listEquipmentLocationChoices, type EquipmentLocationTarget } from "../domain/equipment-locations.ts";
import { requireJob } from "../domain/jobs.ts";
import { requireHome } from "../domain/homes.ts";
import { badRequest } from "../platform/errors.ts";
import type { Db } from "../platform/types.ts";
import { html, raw, type SafeHtml } from "../ui/html.ts";
import { badge, empty } from "../ui/layout.ts";

export function registerEquipmentLocations(router: Router): void {
  router.post("/api/subdivisions/:id/equipment", saveJobEquipment);
  router.post("/api/homes/:id/equipment", saveHomeEquipment);
}

export async function renderEquipmentLocationSection(
  actor: Actor,
  db: Db,
  target: EquipmentLocationTarget,
  action: string,
): Promise<SafeHtml> {
  const [assigned, choices] = await Promise.all([
    listEquipmentAtLocation(db, target),
    listEquipmentLocationChoices(db, target),
  ]);
  const place = target.jobId ? "this job site" : "this house";
  return html`
    <h2>Equipment at ${place}</h2>
    ${assigned.length === 0
      ? empty("No equipment is assigned here yet.")
      : assigned.map((asset) => html`<a class="card" href="/equipment/${asset.asset_tag}">
          <div class="row"><h3>${equipmentLocationName(asset)}</h3>${badge(asset.status, asset.status === "available" || asset.status === "in_use" ? "ok" : "warn")}</div>
          <div class="meta">Fleet ID ${asset.asset_tag}</div>
        </a>`)}
    ${can(actor, "asset.write")
      ? html`<details class="card">
          <summary><strong>Add or remove equipment</strong></summary>
          <p class="meta">Select every machine that belongs here. A machine can be assigned to one place at a time; selecting it here moves it from its previous place.</p>
          <form method="post" action="${action}">
            <fieldset><legend>Choose equipment</legend>
              ${choices.length === 0
                ? html`<p class="meta">No active equipment to assign.</p>`
                : choices.map((asset) => html`<label class="equipment-location-choice">
                    <input type="checkbox" name="asset_id" value="${asset.id}" ${raw(asset.assigned_here ? "checked" : "")}>
                    <span><strong>${equipmentLocationName(asset)}</strong><br><span class="meta">${asset.asset_tag}${asset.other_location ? ` · currently at ${asset.other_location}` : ""}</span></span>
                  </label>`)}
            </fieldset>
            <div class="btn-row"><button type="submit">Save equipment here</button></div>
          </form>
        </details>`
      : ""}
  `;
}

async function saveJobEquipment(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const job = await requireJob(ctx.db, ctx.params.id);
  const assetIds = await selectedAssetIds(ctx);
  await assignEquipmentToLocation(ctx.db, { jobId: job.id }, ctx.actor.employeeId, assetIds);
  return ctx.request.headers.get("Accept")?.includes("application/json")
    ? json({ ok: true })
    : redirect(`/subdivisions/${job.id}?ok=equipment_saved`);
}

async function saveHomeEquipment(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "asset.write");
  const home = await requireHome(ctx.db, ctx.params.id);
  const assetIds = await selectedAssetIds(ctx);
  await assignEquipmentToLocation(ctx.db, { homeId: home.id }, ctx.actor.employeeId, assetIds);
  return ctx.request.headers.get("Accept")?.includes("application/json")
    ? json({ ok: true })
    : redirect(`/homes/${home.id}?ok=equipment_saved`);
}

async function selectedAssetIds(ctx: RequestContext): Promise<string[]> {
  const contentType = ctx.request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      throw badRequest("Body is not valid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Body must be a JSON object");
    const ids = (body as Record<string, unknown>).asset_ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw badRequest("asset_ids must be a list of equipment IDs");
    return ids;
  }
  const form = await readForm(ctx.request);
  return form.getAll("asset_id").filter((value): value is string => typeof value === "string");
}
