/** Authenticated readiness check for the portal's required private bindings. */
import { json } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import type { RequestContext } from "../api/context.ts";

export function registerHealth(router: Router): void {
  router.get("/api/health/ready", readinessRoute);
}

async function readinessRoute(ctx: RequestContext): Promise<Response> {
  // This handler runs after Access verification and active-employee lookup in
  // app.ts. The aggregate verifies the latest schema without reading a row of
  // employee, applicant, vehicle, or customer data.
  try {
    const schema = await ctx.db
      .prepare(
        `SELECT count(*) AS n FROM sqlite_master
          WHERE type = 'table' AND name IN ('employees', 'job_applications', 'asset_insurance_cards')`,
      )
      .first<{ n: number }>();
    if (Number(schema?.n ?? 0) !== 3 || !ctx.store) {
      return json({ status: "not_ready" }, 503);
    }

    // A HEAD on a fixed nonexistent key proves the bucket binding responds.
    // Null is the expected result and no object or metadata is exposed.
    await ctx.store.head("health/readiness-probe");
    return json({ status: "ready", checks: { database: "ok", objectStorage: "ok" } });
  } catch (error) {
    console.error(JSON.stringify({
      message: "portal readiness check failed",
      error: error instanceof Error ? error.message : "unknown error",
    }));
    return json({ status: "not_ready" }, 503);
  }
}
