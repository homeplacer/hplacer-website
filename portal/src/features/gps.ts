import { forbidden } from "../platform/errors.ts";
import { runConfiguredGpsSync } from "../integrations/landairsea-sync.ts";
import { gpsFailureStage } from "../integrations/landairsea.ts";
import type { Router } from "../api/router.ts";
import { assertCan } from "../auth/authz.ts";
import { json, redirect } from "../api/responses.ts";
import { html } from "../ui/html.ts";
import { badge, empty, externalLink, page } from "../ui/layout.ts";

interface GpsDisplayRow {
  device_id: string;
  provider_name: string | null;
  latitude: number | null;
  longitude: number | null;
  reported_at: string | null;
  asset_tag: string | null;
  manufacturer: string | null;
  model: string | null;
}
function timeValue(value: string | null): number | null {
  if (!value || !/T.*(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function localTime(value: string | null): string {
  const ms = timeValue(value);
  return ms === null ? "Unknown" : new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(ms));
}
function mapUrl(device: GpsDisplayRow): string | null {
  const { latitude: lat, longitude: lon } = device;
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}` : null;
}
/** Backend contract for the GPS view; restrict fleet-wide locations to fleet managers. */
export function registerGps(router: Router): void {
  router.post("/api/equipment-gps/refresh", async ctx => {
    assertCan(ctx.actor, "asset.write");
    if (ctx.request.headers.get("Origin") !== ctx.url.origin) throw forbidden("Open the GPS page to check trackers");
    try {
      const result = await runConfiguredGpsSync(ctx.env);
      return redirect(`/equipment-gps?check=${result.enabled ? "saved" : "disabled"}`);
    } catch (error) {
      console.error(JSON.stringify({ message: "GPS manual refresh failed", stage: gpsFailureStage(error) }));
      return redirect("/equipment-gps?check=failed");
    }
  });
  router.get("/equipment-gps", async ctx => {
    assertCan(ctx.actor, "asset.write");
    const devices = await ctx.db.prepare(`SELECT g.*, a.asset_tag, a.manufacturer, a.model
      FROM gps_devices g LEFT JOIN assets a ON a.id=g.asset_id ORDER BY g.provider_name, g.device_id`).all<GpsDisplayRow>();
    const sync = await ctx.db.prepare("SELECT last_success_at FROM gps_sync_state WHERE id='landairsea'").first<{ last_success_at: string }>();
    const now = Date.now();
    return page(html`
      <h1>Equipment GPS</h1>
      ${ctx.url.searchParams.get("check") === "saved" ? html`<p role="status">GPS check completed. Saved readings are shown below.</p>` : ctx.url.searchParams.get("check") === "failed" ? html`<p role="status">GPS check failed. Previous readings are unchanged.</p>` : ctx.url.searchParams.get("check") === "disabled" ? html`<p role="status">GPS checking is disabled.</p>` : ""}
      <form method="post" action="/api/equipment-gps/refresh"><button type="submit">Check trackers now</button></form>
      <p class="lede">Last reported tracker locations. These do not change a machine's assigned job site or availability.</p>
      <p>Last successful API check: <strong>${sync ? localTime(sync.last_success_at) : "Not checked yet"}</strong></p>
      <p class="meta">Times shown in Eastern time. A successful check does not mean every tracker has sent a new location.</p>
      <div class="btn-row"><a class="btn secondary" href="/equipment-gps">Refresh saved readings</a></div>
      ${devices.results.length === 0 ? empty("No tracker readings have been saved yet.") : devices.results.map(device => {
        const ms = timeValue(device.reported_at);
        const status = ms === null ? "Report time unknown" : ms > now ? "Report time is in the future — check needed"
          : now - ms > 24 * 60 * 60 * 1000 ? "Older than 24 hours" : "Reported within 24 hours";
        const linkedName = [device.manufacturer, device.model].filter(Boolean).join(" ").trim() || device.asset_tag;
        const link = mapUrl(device);
        return html`<section class="card" style="overflow-wrap:anywhere">
          <h2>${device.asset_tag ? linkedName : device.provider_name || "Unnamed tracker"}</h2>
          ${device.asset_tag ? html`<p><a href="/equipment/${encodeURIComponent(device.asset_tag)}">Open equipment · ${device.asset_tag}</a></p>` : html`<p class="meta">Not linked to a portal machine</p>`}
          ${device.asset_tag && device.provider_name ? html`<p class="meta">Tracker label: ${device.provider_name}</p>` : ""}
          <p class="meta">Tracker: ${device.device_id}</p>
          ${badge(status, ms === null || ms > now || now - ms > 24 * 60 * 60 * 1000 ? "warn" : "")}
          <p>Last reported: <strong>${localTime(device.reported_at)}</strong></p>
          ${link ? html`<p>${externalLink(link, "Open last reported location in Maps")}</p>` : html`<p>Location unavailable</p>`}
        </section>`;
      })}
    `, { title: "Equipment GPS", actor: ctx.actor, section: "/equipment", back: { href: "/equipment", label: "Equipment" } });
  });
  router.get("/api/equipment-gps", async ctx => {
    assertCan(ctx.actor, "asset.write");
    const devices = await ctx.db.prepare(`SELECT g.*, a.asset_tag, a.manufacturer, a.model
      FROM gps_devices g LEFT JOIN assets a ON a.id=g.asset_id ORDER BY g.device_id`).all();
    const sync = await ctx.db.prepare("SELECT last_success_at, device_count FROM gps_sync_state WHERE id='landairsea'").first();
    const response = json({ devices: devices.results, sync });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
