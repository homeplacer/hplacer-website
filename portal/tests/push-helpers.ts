/** Shared fixtures for the Web Push tests. */
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, hkdfSync, randomBytes, type ECDH } from "node:crypto";
import { base64UrlEncode } from "../src/integrations/web-push.ts";
import type { PortalEnv } from "../src/platform/types.ts";

export const ORIGIN = "http://localhost:8788";

export interface FakeDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
  ecdh: ECDH;
  publicKey: Buffer;
  authSecret: Buffer;
}

/** A browser-side subscription: a real P-256 key pair and auth secret. */
export function fakeDevice(host = "web.push.apple.com"): FakeDevice {
  const ecdh = createECDH("prime256v1");
  const publicKey = ecdh.generateKeys();
  const authSecret = randomBytes(16);
  return {
    endpoint: `https://${host}/${randomBytes(24).toString("base64url")}`,
    p256dh: publicKey.toString("base64url"),
    auth: authSecret.toString("base64url"),
    ecdh,
    publicKey,
    authSecret,
  };
}

/**
 * Independent RFC 8291 / RFC 8188 decryption using Node's OpenSSL-backed
 * primitives (not WebCrypto), standing in for the browser's push stack.
 */
export function decryptPush(body: Uint8Array, device: FakeDevice): string {
  const buffer = Buffer.from(body);
  const salt = buffer.subarray(0, 16);
  const recordSize = buffer.readUInt32BE(16);
  const idLength = buffer[20];
  const serverPublic = buffer.subarray(21, 21 + idLength);
  const ciphertext = buffer.subarray(21 + idLength);
  assert.equal(recordSize, 4096);
  assert.equal(idLength, 65);
  assert.ok(ciphertext.length <= recordSize);

  const ecdhSecret = device.ecdh.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), device.publicKey, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", ecdhSecret, device.authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  let end = plaintext.length - 1;
  while (end >= 0 && plaintext[end] === 0) end -= 1;
  assert.equal(plaintext[end], 0x02, "last-record delimiter");
  return plaintext.subarray(0, end).toString("utf8");
}

export interface VapidFixture {
  publicKey: string;
  privateKey: string;
}

export async function vapidFixture(): Promise<VapidFixture> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: base64UrlEncode(raw), privateKey: jwk.d! };
}

export async function enablePush(env: PortalEnv): Promise<VapidFixture> {
  const vapid = await vapidFixture();
  env.WEB_PUSH_ENABLED = "true";
  env.WEB_PUSH_VAPID_PUBLIC_KEY = vapid.publicKey;
  env.WEB_PUSH_VAPID_PRIVATE_KEY = vapid.privateKey;
  env.WEB_PUSH_SUBJECT = "mailto:ops@hplacer.com";
  return vapid;
}

export interface RecordedPush {
  url: string;
  headers: Headers;
  body: Uint8Array;
  redirect: RequestRedirect | undefined;
}

/** A fetch stand-in for push services; `respond` picks the status per call. */
export function recordingFetch(respond: (push: RecordedPush, index: number) => Response | Promise<Response> = () => new Response(null, { status: 201 })) {
  const calls: RecordedPush[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const push: RecordedPush = {
      url: String(input),
      headers: new Headers(init?.headers),
      body: new Uint8Array(init?.body as Uint8Array),
      redirect: init?.redirect,
    };
    calls.push(push);
    return respond(push, calls.length - 1);
  }) as typeof fetch;
  return { calls, fetcher };
}

/** Same-origin JSON POST as the portal's own opt-in script sends it. */
export function pushPost(body: unknown, extra: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin", ...extra },
    body: JSON.stringify(body),
  };
}

export function subscriptionBody(device: FakeDevice): Record<string, unknown> {
  return { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth }, expirationTime: null };
}
