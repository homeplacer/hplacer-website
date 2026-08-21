import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessCertsUrl,
  accessIssuer,
  readCookie,
  resolveAccessIdentity,
  verifyAccessJwt,
  type JsonWebKeySet,
  type JwksProvider,
} from "../src/auth/access.ts";

const ISSUER = accessIssuer("homeplacer");
const AUDIENCE = "aud-tag-for-the-portal";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function makeSigner() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey & { kid?: string };
  publicJwk.kid = "test-key";
  const jwks: JwksProvider = { async keys(): Promise<JsonWebKeySet> { return { keys: [publicJwk] }; } };

  async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}): Promise<string> {
    const head = encodeSegment({ alg: "RS256", kid: "test-key", ...header });
    const payload = encodeSegment(claims);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      new TextEncoder().encode(`${head}.${payload}`),
    );
    return `${head}.${payload}.${base64Url(new Uint8Array(signature))}`;
  }

  return { sign, jwks };
}

const now = new Date("2026-08-21T12:00:00Z");
const validClaims = {
  iss: ISSUER,
  aud: [AUDIENCE],
  sub: "0123456789abcdef",
  email: "greg@hplacer.com",
  iat: Math.floor(now.getTime() / 1000) - 60,
  exp: Math.floor(now.getTime() / 1000) + 3600,
};

describe("Cloudflare Access token verification", () => {
  it("derives the issuer and certs URL from a team name or full domain", () => {
    assert.equal(accessIssuer("homeplacer"), "https://homeplacer.cloudflareaccess.com");
    assert.equal(accessIssuer("https://homeplacer.cloudflareaccess.com/"), "https://homeplacer.cloudflareaccess.com");
    assert.equal(accessCertsUrl("homeplacer"), "https://homeplacer.cloudflareaccess.com/cdn-cgi/access/certs");
  });

  it("accepts a correctly signed token", async () => {
    const { sign, jwks } = await makeSigner();
    const claims = await verifyAccessJwt(await sign(validClaims), { audience: AUDIENCE, issuer: ISSUER, jwks, now });
    assert.equal(claims.email, "greg@hplacer.com");
    assert.equal(claims.sub, "0123456789abcdef");
  });

  it("rejects a token signed by a different key", async () => {
    const signer = await makeSigner();
    const other = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(await other.sign(validClaims), { audience: AUDIENCE, issuer: ISSUER, jwks: signer.jwks, now }),
      /signature did not verify|unknown key/,
    );
  });

  it("rejects a tampered payload", async () => {
    const { sign, jwks } = await makeSigner();
    const token = await sign(validClaims);
    const [head, , signature] = token.split(".");
    const forged = `${head}.${encodeSegment({ ...validClaims, email: "attacker@example.com" })}.${signature}`;
    await assert.rejects(verifyAccessJwt(forged, { audience: AUDIENCE, issuer: ISSUER, jwks, now }), /signature did not verify/);
  });

  it("rejects another application's audience", async () => {
    const { sign, jwks } = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(await sign({ ...validClaims, aud: ["some-other-app"] }), { audience: AUDIENCE, issuer: ISSUER, jwks, now }),
      /another application/,
    );
  });

  it("rejects another team's issuer", async () => {
    const { sign, jwks } = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(await sign({ ...validClaims, iss: accessIssuer("someoneelse") }), { audience: AUDIENCE, issuer: ISSUER, jwks, now }),
      /another team/,
    );
  });

  it("rejects an expired token", async () => {
    const { sign, jwks } = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(await sign({ ...validClaims, exp: Math.floor(now.getTime() / 1000) - 3600 }), {
        audience: AUDIENCE,
        issuer: ISSUER,
        jwks,
        now,
      }),
      /expired/,
    );
  });

  it("rejects a token that is not valid yet", async () => {
    const { sign, jwks } = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(await sign({ ...validClaims, nbf: Math.floor(now.getTime() / 1000) + 3600 }), {
        audience: AUDIENCE,
        issuer: ISSUER,
        jwks,
        now,
      }),
      /not valid yet/,
    );
  });

  it("refuses the 'none' algorithm", async () => {
    const header = encodeSegment({ alg: "none" });
    const payload = encodeSegment(validClaims);
    const { jwks } = await makeSigner();
    await assert.rejects(
      verifyAccessJwt(`${header}.${payload}.`, { audience: AUDIENCE, issuer: ISSUER, jwks, now }),
      /Unsupported Access token algorithm/,
    );
  });

  it("rejects a malformed token", async () => {
    const { jwks } = await makeSigner();
    await assert.rejects(verifyAccessJwt("not-a-token", { audience: AUDIENCE, issuer: ISSUER, jwks, now }), /Malformed/);
  });
});

describe("identity resolution", () => {
  it("refuses a production request with no assertion", async () => {
    await assert.rejects(
      resolveAccessIdentity(new Request("https://portal.hplacer.com/"), {
        environment: "production",
        teamDomain: "homeplacer",
        audience: AUDIENCE,
      }),
      /Missing Cloudflare Access assertion/,
    );
  });

  it("fails closed when Access is not configured", async () => {
    await assert.rejects(
      resolveAccessIdentity(
        new Request("https://portal.hplacer.com/", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } }),
        { environment: "production" },
      ),
      /Cloudflare Access is not configured/,
    );
  });

  it("never honours the development identity off loopback", async () => {
    await assert.rejects(
      resolveAccessIdentity(
        new Request("https://portal.hplacer.com/", { headers: { "X-Portal-Dev-Identity": "attacker@example.com" } }),
        { environment: "development", devIdentity: "greg@hplacer.com", teamDomain: "homeplacer", audience: AUDIENCE },
      ),
      /Missing Cloudflare Access assertion/,
    );
  });

  it("honours the development identity on loopback", async () => {
    const identity = await resolveAccessIdentity(new Request("http://localhost:8788/"), {
      environment: "development",
      devIdentity: "Greg@hplacer.com",
    });
    assert.equal(identity.email, "greg@hplacer.com");
    assert.equal(identity.method, "local_development");
  });

  it("accepts the Access cookie as well as the header", async () => {
    const { sign, jwks } = await makeSigner();
    const token = await sign(validClaims);
    const identity = await resolveAccessIdentity(
      new Request("https://portal.hplacer.com/", { headers: { Cookie: `other=1; CF_Authorization=${token}` } }),
      { environment: "production", teamDomain: "homeplacer", audience: AUDIENCE, jwks, now },
    );
    assert.equal(identity.email, "greg@hplacer.com");
    assert.equal(identity.method, "access_jwt");
  });

  it("reads a named cookie without matching a suffix", () => {
    assert.equal(readCookie("NOT_CF_Authorization=abc; CF_Authorization=xyz", "CF_Authorization"), "xyz");
    assert.equal(readCookie(null, "CF_Authorization"), null);
  });
});
