/**
 * Phone alerts (Web Push) for the installed portal app.
 *
 * Every route here sits behind the same Cloudflare Access + active-employee
 * pipeline as the rest of the portal. State-changing routes also require a
 * same-origin request (Origin and, when sent, Sec-Fetch-Site) so another site
 * cannot drive them through a signed-in browser; the JSON routes additionally
 * refuse anything a plain HTML form could send cross-site.
 *
 * Responses never include a push endpoint, a subscription key, or VAPID
 * private material.
 */
import type { RequestContext } from "../api/context.ts";
import { json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import {
  IMMEDIATE_DRAIN,
  isRegistered,
  registerSubscription,
  runWebPush,
  sendTestAlert,
  unregisterDevice,
  unregisterEndpoint,
} from "../domain/push.ts";
import { loadWebPushConfig, WebPushSender } from "../integrations/web-push.ts";
import { badRequest, forbidden, PortalError } from "../platform/errors.ts";
import { securityHeaders } from "../ui/layout.ts";
import { APP_ICONS_BASE64 } from "../ui/app-icons.ts";
import { PUSH_CLIENT_JS, SERVICE_WORKER_JS, WEB_APP_MANIFEST } from "../ui/app-shell.ts";
import { wantsJson } from "./equipment.ts";

export function registerPush(router: Router): void {
  router.get("/manifest.webmanifest", async () => staticFile(WEB_APP_MANIFEST, "application/manifest+json; charset=utf-8"));
  router.get("/sw.js", async () =>
    staticFile(SERVICE_WORKER_JS, "text/javascript; charset=utf-8", {
      // The worker's own policy: it may load its icon and nothing else.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "Cache-Control": "no-cache, private",
    }));
  router.get("/push-client.js", async () => staticFile(PUSH_CLIENT_JS, "text/javascript; charset=utf-8"));
  router.get("/apple-touch-icon.png", async () => icon("180"));
  router.get("/app-icon-192.png", async () => icon("192"));
  router.get("/app-icon-512.png", async () => icon("512"));

  router.get("/api/push/config", async (ctx) => {
    const keys = await loadWebPushConfig(ctx.env);
    return json({ enabled: Boolean(keys), publicKey: keys?.publicKey ?? null });
  });

  router.post("/api/push/subscriptions", async (ctx) => {
    requireSameOrigin(ctx);
    if (!(await loadWebPushConfig(ctx.env))) throw pushDisabled();
    const body = await readJsonObject(ctx);
    const keys = typeof body.keys === "object" && body.keys !== null ? body.keys as Record<string, unknown> : {};
    const result = await registerSubscription(ctx.db, ctx.actor.employeeId, {
      endpoint: body.endpoint,
      p256dh: body.p256dh ?? keys.p256dh,
      auth: body.auth ?? keys.auth,
    });
    return json({ id: result.id, transferred: result.transferred }, result.created ? 201 : 200);
  });

  router.post("/api/push/subscriptions/check", async (ctx) => {
    requireSameOrigin(ctx);
    const body = await readJsonObject(ctx);
    return json({ registered: await isRegistered(ctx.db, ctx.actor.employeeId, body.endpoint) });
  });

  router.post("/api/push/subscriptions/remove", async (ctx) => {
    requireSameOrigin(ctx);
    const body = await readJsonObject(ctx);
    return json({ removed: await unregisterEndpoint(ctx.db, ctx.actor.employeeId, body.endpoint) });
  });

  // Plain form from the device list on the notifications page.
  router.post("/api/push/devices/:id/delete", async (ctx) => {
    requireSameOrigin(ctx);
    await unregisterDevice(ctx.db, ctx.actor.employeeId, ctx.params.id);
    return wantsJson(ctx) ? json({ ok: true }) : redirect("/notifications?ok=push_device_removed");
  });

  router.post("/api/push/test", async (ctx) => {
    requireSameOrigin(ctx);
    await readJsonObject(ctx);
    const keys = await loadWebPushConfig(ctx.env);
    if (!keys) throw pushDisabled();
    const result = await sendTestAlert(ctx.db, new WebPushSender(keys), ctx.actor.employeeId);
    return json(result);
  });
}

/**
 * After a task is assigned, start delivering its alerts without waiting for
 * the five-minute cron. Bounded so the request's background time stays short;
 * the cron drains anything left, and the lease prevents double sends.
 */
export function drainPushSoon(ctx: RequestContext): void {
  if (!ctx.waitUntil || ctx.env.WEB_PUSH_ENABLED !== "true") return;
  ctx.waitUntil(runWebPush(ctx.env, fetch, IMMEDIATE_DRAIN).catch(() => {
    console.error("immediate push delivery failed; the scheduled run will retry");
  }));
}

function pushDisabled(): PortalError {
  return new PortalError(503, "push_disabled", "Phone alerts are not turned on for the portal yet");
}

/** CSRF boundary for every state-changing push route. */
export function requireSameOrigin(ctx: RequestContext): void {
  const origin = ctx.request.headers.get("Origin");
  if (!origin || origin !== ctx.url.origin) throw forbidden("Open the notifications page to change phone alerts");
  const site = ctx.request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") throw forbidden("Open the notifications page to change phone alerts");
}

/** JSON only: a cross-site HTML form cannot send `application/json` without a CORS preflight. */
async function readJsonObject(ctx: RequestContext): Promise<Record<string, unknown>> {
  const contentType = ctx.request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new PortalError(415, "unsupported_media_type", "Send this request as JSON");
  }
  const length = Number(ctx.request.headers.get("Content-Length") ?? "0");
  if (length > 8192) throw badRequest("Request is too large");
  const text = await ctx.request.text();
  if (text.length > 8192) throw badRequest("Request is too large");
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Body is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw badRequest("Body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function staticFile(body: string, contentType: string, extra: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers: securityHeaders({ "Content-Type": contentType, ...extra }) });
}

const iconBytes = new Map<string, Uint8Array<ArrayBuffer>>();

function icon(size: string): Response {
  let bytes = iconBytes.get(size);
  if (!bytes) {
    const binary = atob(APP_ICONS_BASE64[size]);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    iconBytes.set(size, bytes);
  }
  return new Response(bytes, {
    status: 200,
    headers: securityHeaders({ "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" }),
  });
}
