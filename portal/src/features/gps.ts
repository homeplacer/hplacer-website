import type { Router } from "../api/router.ts";
import { assertCan } from "../auth/authz.ts";
import { json } from "../api/responses.ts";
/** Backend contract for the GPS view; restrict fleet-wide locations to fleet managers. */
export function registerGps(router: Router): void {
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
