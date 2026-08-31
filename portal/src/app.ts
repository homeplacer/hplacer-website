/**
 * The portal request pipeline.
 *
 * Order matters and is the same for every route, HTML or JSON:
 *
 *   0. Two exceptions, checked first and by exact path: warranty intake and job
 *      application intake, each called by hplacer.com with a separate bearer
 *      token. They write one record and return a reference; they read nothing.
 *      See features/public-intake.ts.
 *   1. Verify the Cloudflare Access assertion (or the loopback dev identity).
 *   2. Resolve it to an active employee record — Access proves identity, the
 *      employee row grants access.
 *   3. Match a route.
 *   4. Run the handler, which re-checks permission for the specific action.
 *   5. Record the outcome in the audit log, allowed or denied.
 *
 * Apart from those two intake routes, nothing is reachable without an employee
 * identity. A request that fails step 1 or 2 never reaches a query.
 */
import { resolveAccessIdentity, type AccessConfig, type AccessIdentity } from "./auth/access.ts";
import { loadActor } from "./auth/session.ts";
import type { Actor } from "./auth/authz.ts";
import { recordAudit } from "./domain/audit.ts";
import { QueuedMondaySyncPort, type MondaySyncPort } from "./integrations/monday.ts";
import { isPortalError, notFound, PortalError } from "./platform/errors.ts";
import { newId } from "./platform/ids.ts";
import type { PortalEnv } from "./platform/types.ts";
import type { RequestContext } from "./api/context.ts";
import { errorMessage, errorStatus, json } from "./api/responses.ts";
import { Router } from "./api/router.ts";
import { registerAdmin } from "./features/admin.ts";
import { registerDashboard } from "./features/dashboard.ts";
import { registerDocuments } from "./features/documents.ts";
import { registerEquipment } from "./features/equipment.ts";
import { registerHomes } from "./features/homes.ts";
import { registerInventory } from "./features/inventory.ts";
import { registerPortableJohn } from "./features/portable-john.ts";
import { handlePublicJobApplicationIntake, handlePublicWarrantyIntake, isPublicIntakeRequest, PUBLIC_JOB_APPLICATION_PATH } from "./features/public-intake.ts";
import { registerSubdivisions } from "./features/subdivisions.ts";
import { registerRepairs } from "./features/repairs.ts";
import { registerTasks } from "./features/tasks.ts";
import { registerWarranty } from "./features/warranty.ts";
import { errorPage } from "./ui/error-page.ts";

export function buildRouter(): Router {
  const router = new Router();
  registerDashboard(router);
  registerSubdivisions(router);
  registerHomes(router);
  registerEquipment(router);
  registerTasks(router);
  registerRepairs(router);
  registerWarranty(router);
  registerInventory(router);
  registerPortableJohn(router);
  registerDocuments(router);
  registerAdmin(router);
  return router;
}

const router = buildRouter();

export interface HandleOptions {
  /** Overrides for tests: a pre-resolved identity, a fixed clock, a fake JWKS. */
  access?: AccessConfig;
  identity?: AccessIdentity;
  monday?: MondaySyncPort;
}

export async function handleRequest(request: Request, env: PortalEnv, options: HandleOptions = {}): Promise<Response> {
  const url = new URL(request.url);
  const requestId = newId("req");
  const wantsJson = prefersJson(request);

  if (!env.PORTAL_DB) {
    return respondError(new PortalError(503, "no_database", "The portal database is not bound to this Worker"), wantsJson);
  }

  // The two public write-only routes are matched by exact path before anything
  // else, so lookalikes cannot reach them or fall through to a staff route.
  if (isPublicIntakeRequest(request.method, url.pathname)) {
    if (url.pathname === PUBLIC_JOB_APPLICATION_PATH) return handlePublicJobApplicationIntake(request, env, requestId);
    return handlePublicWarrantyIntake(request, env, requestId);
  }

  let identity: AccessIdentity;
  try {
    identity =
      options.identity ??
      (await resolveAccessIdentity(request, {
        teamDomain: env.ACCESS_TEAM_DOMAIN,
        audience: env.ACCESS_AUD,
        environment: env.PORTAL_ENVIRONMENT,
        devIdentity: env.PORTAL_DEV_IDENTITY,
        ...options.access,
      }));
  } catch (error) {
    return respondError(error, wantsJson);
  }

  let actor: Actor;
  try {
    actor = await loadActor(env.PORTAL_DB, identity);
  } catch (error) {
    await safeAudit(env, {
      actorEmail: identity.email,
      action: `${request.method} ${url.pathname}`,
      entityType: "session",
      outcome: "denied",
      detail: errorMessage(error),
      requestId,
    });
    return respondError(error, wantsJson);
  }

  const match = router.match(request.method, url.pathname);
  if (!match) {
    const allowed = router.allowedMethods(url.pathname);
    if (allowed.length > 0) {
      return respondError(new PortalError(405, "method_not_allowed", `That address does not accept ${request.method}`), wantsJson, actor);
    }
    return respondError(notFound("That page does not exist"), wantsJson, actor);
  }

  const ctx: RequestContext = {
    request,
    url,
    env,
    db: env.PORTAL_DB,
    store: env.PORTAL_PHOTOS,
    actor,
    params: match.params,
    monday: options.monday ?? new QueuedMondaySyncPort(env.PORTAL_DB),
    requestId,
  };

  const mutating = request.method !== "GET" && request.method !== "HEAD";
  try {
    const response = await match.handler(ctx);
    if (mutating) {
      await safeAudit(env, {
        actorEmployeeId: actor.employeeId,
        actorEmail: actor.email,
        action: `${request.method} ${url.pathname}`,
        entityType: entityTypeFor(url.pathname),
        entityId: match.params.id ?? match.params.tag ?? null,
        outcome: "allowed",
        requestId,
      });
    }
    return response;
  } catch (error) {
    // 4xx from a permission or validation check is worth recording; a 5xx is a
    // bug and is recorded too, so the two are distinguishable afterwards.
    await safeAudit(env, {
      actorEmployeeId: actor.employeeId,
      actorEmail: actor.email,
      action: `${request.method} ${url.pathname}`,
      entityType: entityTypeFor(url.pathname),
      entityId: match.params.id ?? match.params.tag ?? null,
      outcome: "denied",
      detail: `${errorStatus(error)}: ${errorMessage(error)}`,
      requestId,
    });
    if (!isPortalError(error)) {
      console.error(`portal ${requestId} ${request.method} ${url.pathname}`, error);
    }
    return respondError(error, wantsJson, actor);
  }
}

function prefersJson(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  const contentType = request.headers.get("Content-Type") ?? "";
  if (new URL(request.url).pathname.startsWith("/api/") && !accept.includes("text/html")) return true;
  return contentType.includes("application/json") || (accept.includes("application/json") && !accept.includes("text/html"));
}

function entityTypeFor(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "api") return parts[1] ?? "portal";
  return parts[0] ?? "portal";
}

function respondError(error: unknown, wantsJson: boolean, actor?: Actor): Response {
  const status = errorStatus(error);
  const message = errorMessage(error);
  const code = isPortalError(error) ? error.code : "internal_error";
  if (wantsJson) return json({ error: code, message, detail: isPortalError(error) ? error.detail : undefined }, status);

  const title =
    status === 401 ? "Sign-in required" : status === 403 ? "Not allowed" : status === 404 ? "Not found" : "Something went wrong";
  return errorPage(status, title, message, actor ? `Signed in as ${actor.email}.` : null);
}

/** The audit log must never be the reason a request fails. */
async function safeAudit(env: PortalEnv, entry: Parameters<typeof recordAudit>[1]): Promise<void> {
  try {
    await recordAudit(env.PORTAL_DB, entry);
  } catch (error) {
    console.error("portal audit write failed", error);
  }
}
