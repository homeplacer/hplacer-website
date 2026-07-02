import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Content-Security-Policy allowlist for our known third parties: GA
// (googletagmanager / google-analytics), Leaflet (unpkg), and image/iframe
// sources — manufacturer photo CDNs, OSM map tiles, and virtual-tour embeds —
// via `https:`. Ships as REPORT-ONLY first so it can never break the live site;
// promote to enforcing (`Content-Security-Policy`) after observing real-traffic
// reports. (See TODO.md.)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Apply security response headers to every page/route this middleware runs on.
// The non-CSP headers are safe to enforce immediately. HSTS + CSP are prod-only:
// `next dev` needs eval/websockets for HMR and has no TLS, so we don't constrain
// or HSTS-pin localhost.
function withSecurityHeaders(res: NextResponse, isLocal: boolean): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (!isLocal) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.headers.set("Content-Security-Policy-Report-Only", CSP);
  }
  return res;
}

// Force HTTPS at the edge (equivalent of Cloudflare's "Always Use HTTPS").
// LOOP-SAFE BY DESIGN: we only redirect when the visitor's scheme is EXPLICITLY
// "http". An https request (or a request where the scheme is unknown) passes
// through untouched, so a redirected request — which arrives as https — is never
// redirected again. Cloudflare exposes the visitor scheme via the CF-Visitor
// header ({"scheme":"https"}) and X-Forwarded-Proto.
export function middleware(req: NextRequest) {
  // Never force HTTPS for local development — `next dev` has no TLS, so a
  // redirect to https://localhost just dead-ends. Host-based (not NODE_ENV) so
  // production Always-HTTPS on hplacer.com is unaffected.
  const host = req.nextUrl.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";

  if (!isLocal) {
    const xfp = req.headers.get("x-forwarded-proto");
    let scheme: string | null = xfp;
    if (!scheme) {
      const cfv = req.headers.get("cf-visitor");
      if (cfv) {
        try {
          scheme = JSON.parse(cfv).scheme ?? null;
        } catch {
          scheme = null;
        }
      }
    }

    if (scheme === "http") {
      const url = req.nextUrl.clone();
      url.protocol = "https:";
      url.port = "";
      return withSecurityHeaders(NextResponse.redirect(url, 308), isLocal);
    }
  }

  return withSecurityHeaders(NextResponse.next(), isLocal);
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
