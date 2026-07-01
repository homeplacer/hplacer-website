import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return NextResponse.next();
  }

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
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
