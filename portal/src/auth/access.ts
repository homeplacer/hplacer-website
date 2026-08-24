/**
 * Cloudflare Access identity.
 *
 * Access is the outer gate: the portal hostname sits behind an Access policy so
 * an unauthenticated request never reaches the Worker. That is not treated as
 * sufficient. The Worker independently verifies the `Cf-Access-Jwt-Assertion`
 * signature, audience, issuer, and expiry on every request, so a misconfigured
 * or removed Access application fails closed instead of exposing the portal.
 */
import { PortalError, unauthorized } from "../platform/errors.ts";

export interface AccessIdentity {
  /** Access `sub` claim — stable per user, stored as employees.access_subject. */
  subject: string;
  email: string;
  /** How the identity was established; recorded in the audit log. */
  method: "access_jwt" | "local_development";
}

export interface AccessJwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
}

export interface JsonWebKeySet {
  keys: (JsonWebKey & { kid?: string; alg?: string })[];
}

export interface JwksProvider {
  /** Returns the team's signing keys. Implementations should cache. */
  keys(): Promise<JsonWebKeySet>;
}

const CLOCK_SKEW_SECONDS = 60;

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

export function accessIssuer(teamDomain: string): string {
  const team = teamDomain.replace(/^https?:\/\//, "").replace(/\.cloudflareaccess\.com\/?$/, "");
  return `https://${team}.cloudflareaccess.com`;
}

export function accessCertsUrl(teamDomain: string): string {
  return `${accessIssuer(teamDomain)}/cdn-cgi/access/certs`;
}

/**
 * Verifies an Access JWT and returns its claims. Throws `PortalError(401)` for
 * every failure mode — a caller can never accidentally treat an unverified
 * token as verified.
 */
export async function verifyAccessJwt(
  token: string,
  options: { audience: string; issuer: string; jwks: JwksProvider; now?: Date },
): Promise<AccessJwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw unauthorized("Malformed Access token");

  let header: { alg?: string; kid?: string };
  let claims: AccessJwtClaims;
  try {
    header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
    claims = decodeJson<AccessJwtClaims>(parts[1]);
  } catch {
    throw unauthorized("Unreadable Access token");
  }

  if (header.alg !== "RS256") throw unauthorized(`Unsupported Access token algorithm: ${header.alg}`);

  const { keys } = await options.jwks.keys();
  const candidates = header.kid ? keys.filter((key) => key.kid === header.kid) : keys;
  if (candidates.length === 0) throw unauthorized("Access token was signed by an unknown key");

  const signature = base64UrlToBytes(parts[2]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  let verified = false;
  for (const jwk of candidates) {
    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        "jwk",
        { ...jwk, alg: "RS256", ext: true, key_ops: ["verify"] },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    } catch {
      continue;
    }
    if (await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature as BufferSource, signed as BufferSource)) {
      verified = true;
      break;
    }
  }
  if (!verified) throw unauthorized("Access token signature did not verify");

  if (claims.iss !== options.issuer) throw unauthorized("Access token was issued by another team");

  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!audiences.includes(options.audience)) throw unauthorized("Access token was issued for another application");

  const nowSeconds = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw unauthorized("Access token has expired");
  }
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw unauthorized("Access token is not valid yet");
  }
  if (!claims.sub) throw unauthorized("Access token has no subject");
  if (!claims.email) throw unauthorized("Access token has no email");

  return claims;
}

/** Caches the team JWKS in module scope for the life of an isolate. */
export function createJwksProvider(teamDomain: string, fetcher: typeof fetch = fetch, ttlMs = 60 * 60 * 1000): JwksProvider {
  let cached: JsonWebKeySet | null = null;
  let expiresAt = 0;
  const url = accessCertsUrl(teamDomain);

  return {
    async keys() {
      if (cached && Date.now() < expiresAt) return cached;
      const response = await fetcher(url);
      if (!response.ok) throw unauthorized("Could not load Access signing keys");
      cached = (await response.json()) as JsonWebKeySet;
      expiresAt = Date.now() + ttlMs;
      return cached;
    },
  };
}

function isLoopback(request: Request): boolean {
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

export interface AccessConfig {
  teamDomain?: string;
  audience?: string;
  environment?: string;
  devIdentity?: string;
  jwks?: JwksProvider;
  now?: Date;
}

/**
 * Resolves the caller's Access identity, or throws 401.
 *
 * The development path is guarded twice — it needs a non-production
 * `PORTAL_ENVIRONMENT` *and* a loopback request URL — so a config slip alone
 * cannot turn a deployed portal into an open one.
 */
export async function resolveAccessIdentity(request: Request, config: AccessConfig): Promise<AccessIdentity> {
  const isProduction = (config.environment ?? "production") === "production";

  if (!isProduction && isLoopback(request)) {
    const email = request.headers.get("X-Portal-Dev-Identity") ?? config.devIdentity;
    if (!email) throw unauthorized("Set PORTAL_DEV_IDENTITY to sign in locally");
    return { subject: `dev|${email.toLowerCase()}`, email: email.toLowerCase(), method: "local_development" };
  }

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    readCookie(request.headers.get("Cookie"), "CF_Authorization");
  if (!token) throw unauthorized("Missing Cloudflare Access assertion");

  if (!config.teamDomain || !config.audience) {
    // Fail closed: without both settings there is nothing to verify against.
    throw new PortalError(503, "access_unconfigured", "Cloudflare Access is not configured for this portal");
  }

  const jwks = config.jwks ?? createJwksProvider(config.teamDomain);
  const claims = await verifyAccessJwt(token, {
    audience: config.audience,
    issuer: accessIssuer(config.teamDomain),
    jwks,
    now: config.now,
  });

  return { subject: claims.sub as string, email: (claims.email as string).toLowerCase(), method: "access_jwt" };
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
}
