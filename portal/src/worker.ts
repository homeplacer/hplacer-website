import { gpsFailureStage } from "./integrations/landairsea.ts";
/**
 * Cloudflare Worker entry point for portal.hplacer.com.
 *
 * This is a separate Worker from the public hplacer.com site: separate script,
 * separate bindings, separate route. Nothing in the marketing app imports this
 * module, and nothing here imports the marketing app.
 */
import { runConfiguredGpsSync } from "./integrations/landairsea-sync.ts";
import { handleRequest } from "./app.ts";
import { sweepLowStock } from "./domain/inventory.ts";
import { notifyServiceDue } from "./domain/assets.ts";
import { sendDailyDigest } from "./domain/daily-digest.ts";
import { notifyInsuranceExpirations } from "./domain/insurance.ts";
import { runConfiguredMondaySync } from "./integrations/monday-sync-processor.ts";
import { runConfiguredMondayHomesImport } from "./integrations/monday-homes-import.ts";
import { runConfiguredGmailImport } from "./integrations/gmail-import.ts";
import { runTaskAssignmentEmail } from "./integrations/task-assignment-email.ts";
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
  async scheduled(event: { cron: string }, env: PortalEnv): Promise<void> {
    if (!env.PORTAL_DB) return;
    if (event.cron === "*/5 * * * *") {
      if (env.TASK_EMAIL_NOTIFICATIONS_ENABLED === "true") {
        try {
          const email = await runTaskAssignmentEmail(env);
          if (email.enabled) {
            console.log(JSON.stringify({ message: "task-assignment email delivery complete", ...email }));
          } else {
            console.error("task-assignment email delivery is enabled but configuration is incomplete");
          }
        } catch {
          console.error("task-assignment email delivery failed; check provider configuration and retry");
        }
      }
      return;
    }
    if (event.cron === "*/15 * * * *") {
      try {
        const gps = await runConfiguredGpsSync(env);
        if (gps.enabled) console.log(JSON.stringify({ message: "GPS poll complete", devices: gps.devices }));
      } catch (error) {
        console.error(JSON.stringify({ message: "GPS poll failed; last successful observations retained", stage: gpsFailureStage(error) }));
      }
      try {
        const gmail = await runConfiguredGmailImport(env);
        if (gmail.enabled) {
          console.log(JSON.stringify({
            message: "vendor email poll complete",
            found: gmail.found,
            staged: gmail.staged,
            failed: gmail.failed,
            skipped: gmail.skipped,
          }));
        }
      } catch {
        // Do not log remote response bodies, OAuth data, headers, or email content.
        console.error("vendor email poll failed; check Gmail configuration and retry; no mailbox contents are logged");
      }
      try {
        const homes = await runConfiguredMondayHomesImport(env);
        if (homes.enabled) {
          console.log(JSON.stringify({ message: "Monday home roster import complete", ...homes }));
        }
      } catch {
        // The GraphQL client redacts credentials; keep board data out of logs.
        console.error("Monday home roster import failed; check the read-only board connection");
      }
      return;
    }
    const lowStock = await sweepLowStock(env.PORTAL_DB);
    const serviceDue = await notifyServiceDue(env.PORTAL_DB);
    const insuranceExpiring = await notifyInsuranceExpirations(env.PORTAL_DB);
    const digest = await sendDailyDigest(env.PORTAL_DB);
    console.log(JSON.stringify({
      message: "portal maintenance sweep complete",
      lowStock,
      serviceDue,
      insuranceExpiring,
      dailyDigests: digest,
    }));
    try {
      const monday = await runConfiguredMondaySync(env, { limit: 50 });
      if (monday.enabled) {
        console.log(JSON.stringify({
          message: "Monday sync complete",
          sent: monday.sent,
          alreadyApplied: monday.alreadyApplied,
          conflicts: monday.conflicts,
          retries: monday.retried,
        }));
      }
    } catch {
      // Details are retained in redacted queue/audit records. Never put remote
      // values or the token in Worker logs.
      console.error("Monday sync configuration or processing failed; see portal audit log");
    }
  },
};

export default portal;
