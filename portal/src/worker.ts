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
import type { PortalEnv } from "./platform/types.ts";

const portal = {
  async fetch(request: Request, env: PortalEnv): Promise<Response> {
    return handleRequest(request, env);
  },

  /**
   * Morning sweep: low-stock alerts and equipment coming due for service.
   * Configure with a cron trigger on the portal Worker.
   */
  async scheduled(_event: { cron: string }, env: PortalEnv): Promise<void> {
    if (!env.PORTAL_DB) return;
    const lowStock = await sweepLowStock(env.PORTAL_DB);
    const serviceDue = await notifyServiceDue(env.PORTAL_DB);
    console.log(`portal sweep: ${lowStock} low-stock alerts, ${serviceDue} service notices`);
  },
};

export default portal;
