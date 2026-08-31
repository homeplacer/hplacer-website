/**
 * Cloudflare Worker entry point for portal.hplacer.com.
 *
 * This is a separate Worker from the public hplacer.com site: separate script,
 * separate bindings, separate route. Nothing in the marketing app imports this
 * module, and nothing here imports the marketing app.
 */
import { handleRequest } from "./app.ts";
import { sweepLowStock } from "./domain/inventory.ts";
import { notifyServiceDue } from "./domain/assets.ts";
import { sendDailyDigest } from "./domain/daily-digest.ts";
import type { PortalEnv } from "./platform/types.ts";

const portal = {
  async fetch(request: Request, env: PortalEnv): Promise<Response> {
    return handleRequest(request, env);
  },

  /**
   * Morning sweep: low-stock alerts, equipment coming due for service, and a
   * single routed operations digest. The digest has per-person daily dedupe,
   * so a manual/retried cron invocation cannot flood inboxes.
   * Configure with a cron trigger on the portal Worker.
   */
  async scheduled(_event: { cron: string }, env: PortalEnv): Promise<void> {
    if (!env.PORTAL_DB) return;
    const lowStock = await sweepLowStock(env.PORTAL_DB);
    const serviceDue = await notifyServiceDue(env.PORTAL_DB);
    const digest = await sendDailyDigest(env.PORTAL_DB);
    console.log(`portal sweep: ${lowStock} low-stock alerts, ${serviceDue} service notices, ${digest} daily digests`);
  },
};

export default portal;
