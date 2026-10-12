/**
 * Standards Web Push transport, built only from WebCrypto primitives so it runs
 * unchanged in Cloudflare Workers and Node's test runner.
 *
 * - Payload encryption: RFC 8291 (Message Encryption for Web Push) using the
 *   RFC 8188 `aes128gcm` content coding — ECDH P-256, HKDF-SHA-256, AES-128-GCM.
 * - Sender identity: RFC 8292 VAPID — an ES256 JWT with `aud` set to the push
 *   service origin.
 *
 * Nothing here logs. Errors carry an HTTP status or a fixed code, never an
 * endpoint, key, token, or response body.
 */

export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Bytes {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) throw new WebPushConfigError("invalid_base64url");
  const normalized = value.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new WebPushConfigError("invalid_base64url");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class WebPushConfigError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Web Push configuration or subscription is invalid (${code})`);
    this.name = "WebPushConfigError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Endpoint and subscription validation (SSRF boundary)
// ---------------------------------------------------------------------------

/**
 * Push services the portal will contact. A subscription endpoint is supplied
 * by the browser, which means by the client — so it is an untrusted URL and
 * the Worker only ever sends to these hosts over HTTPS on the default port.
 * Apple asks servers that filter endpoints to allow `*.push.apple.com`.
 */
const EXACT_PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com"]);
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".push.services.mozilla.com", ".notify.windows.com"];
const MAX_ENDPOINT_LENGTH = 1024;

export type PushService = "apple" | "google" | "mozilla" | "microsoft";

export function pushServiceFor(host: string): PushService | null {
  const lower = host.toLowerCase();
  if (lower.endsWith(".push.apple.com")) return "apple";
  if (lower === "fcm.googleapis.com") return "google";
  if (lower === "updates.push.services.mozilla.com" || lower.endsWith(".push.services.mozilla.com")) return "mozilla";
  if (lower.endsWith(".notify.windows.com")) return "microsoft";
  return null;
}

/** Returns the parsed endpoint, or throws a WebPushConfigError with a fixed code. */
export function validatePushEndpoint(value: unknown): URL {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) {
    throw new WebPushConfigError("endpoint_length");
  }
  if (/[\s\\]/.test(value)) throw new WebPushConfigError("endpoint_characters");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebPushConfigError("endpoint_unparseable");
  }
  if (url.protocol !== "https:") throw new WebPushConfigError("endpoint_not_https");
  if (url.username || url.password) throw new WebPushConfigError("endpoint_credentials");
  if (url.port !== "") throw new WebPushConfigError("endpoint_port");
  if (url.hash) throw new WebPushConfigError("endpoint_fragment");
  const host = url.hostname.toLowerCase();
  const known = EXACT_PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
  if (!known || pushServiceFor(host) === null) throw new WebPushConfigError("endpoint_host");
  return url;
}

export interface SubscriptionKeys {
  p256dh: Bytes;
  auth: Bytes;
}

/** Validates the browser's `p256dh` (uncompressed P-256 point) and `auth` (16 bytes). */
export async function validateSubscriptionKeys(p256dh: unknown, auth: unknown): Promise<SubscriptionKeys> {
  if (typeof p256dh !== "string" || p256dh.length > 128) throw new WebPushConfigError("p256dh");
  if (typeof auth !== "string" || auth.length > 64) throw new WebPushConfigError("auth");
  const publicKey = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new WebPushConfigError("p256dh");
  if (authSecret.length !== 16) throw new WebPushConfigError("auth");
  try {
    // Import rejects points that are not on the curve.
    await crypto.subtle.importKey("raw", publicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  } catch {
    throw new WebPushConfigError("p256dh");
  }
  return { p256dh: publicKey, auth: authSecret };
}

// ---------------------------------------------------------------------------
// VAPID (RFC 8292)
// ---------------------------------------------------------------------------

export interface VapidKeys {
  /** base64url uncompressed P-256 public key (65 bytes); handed to browsers. */
  publicKey: string;
  subject: string;
  privateKey: CryptoKey;
}

/**
 * Imports the server's VAPID key pair. The private key is the base64url
 * 32-byte scalar `d`. A sign/verify round trip proves the halves belong
 * together, so a mismatched secret fails here instead of at every push service.
 */
export async function importVapidKeys(publicKey: string, privateKey: string, subject: string): Promise<VapidKeys> {
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) throw new WebPushConfigError("vapid_subject");
  const pub = base64UrlDecode(publicKey.trim());
  const d = base64UrlDecode(privateKey.trim());
  if (pub.length !== 65 || pub[0] !== 0x04) throw new WebPushConfigError("vapid_public_key");
  if (d.length !== 32) throw new WebPushConfigError("vapid_private_key");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(pub.slice(1, 33)),
    y: base64UrlEncode(pub.slice(33, 65)),
    d: base64UrlEncode(d),
    ext: false,
  };
  let signingKey: CryptoKey;
  let verifyKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    verifyKey = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    throw new WebPushConfigError("vapid_keys");
  }
  const probe = encoder.encode("vapid-key-pair-check");
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, probe);
  const matches = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, signature, probe);
  if (!matches) throw new WebPushConfigError("vapid_key_mismatch");
  return { publicKey: base64UrlEncode(pub), subject, privateKey: signingKey };
}

/** VAPID lifetime well inside the 24-hour ceiling every push service enforces. */
const VAPID_TTL_SECONDS = 12 * 60 * 60;
/** Reuse a token until it has less than this long left (Apple: refresh at most hourly). */
const VAPID_REFRESH_MARGIN_SECONDS = 60 * 60;
const VAPID_CACHE_LIMIT = 16;

/**
 * Isolate-wide cache of signed tokens, keyed by push origin + key + subject.
 * The value is a short-lived bearer credential for our own VAPID identity, so
 * it stays in memory only and is never persisted or logged.
 */
const vapidTokenCache = new Map<string, { header: string; expiresAt: number }>();

/** Cached Authorization header for this push service origin. */
export async function vapidAuthorizationCached(keys: VapidKeys, endpoint: URL, now: Date = new Date()): Promise<string> {
  const cacheKey = `${endpoint.origin}|${keys.publicKey}|${keys.subject}`;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const cached = vapidTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - nowSeconds > VAPID_REFRESH_MARGIN_SECONDS) return cached.header;
  const header = await vapidAuthorization(keys, endpoint, now);
  if (vapidTokenCache.size >= VAPID_CACHE_LIMIT) vapidTokenCache.clear();
  vapidTokenCache.set(cacheKey, { header, expiresAt: nowSeconds + VAPID_TTL_SECONDS });
  return header;
}

export function clearVapidTokenCache(): void {
  vapidTokenCache.clear();
}

export async function vapidAuthorization(keys: VapidKeys, endpoint: URL, now: Date = new Date()): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({
    aud: endpoint.origin,
    exp: Math.floor(now.getTime() / 1000) + VAPID_TTL_SECONDS,
    sub: keys.subject,
  })));
  const signingInput = `${header}.${claims}`;
  // WebCrypto ECDSA output is IEEE P1363 r||s, which is exactly the JWS ES256 form.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, encoder.encode(signingInput)));
  return `vapid t=${signingInput}.${base64UrlEncode(signature)}, k=${keys.publicKey}`;
}

// ---------------------------------------------------------------------------
// Payload encryption (RFC 8291 / RFC 8188 aes128gcm, single record)
// ---------------------------------------------------------------------------

const RECORD_SIZE = 4096;
/** One aes128gcm record: header (86) + plaintext + delimiter (1) + tag (16) ≤ 4096. */
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - 86 - 17;

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", concat(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: concat(salt), info: concat(info) }, key, length * 8));
}

export interface EncryptOptions {
  /** Test hook: fixed application-server ECDH key pair (RFC 8291 Appendix A). */
  serverKeys?: { privateKey: CryptoKey; publicKey: Bytes };
  /** Test hook: fixed 16-byte salt. */
  salt?: Bytes;
}

export async function encryptPayload(plaintext: Uint8Array, keys: SubscriptionKeys, options: EncryptOptions = {}): Promise<Bytes> {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new WebPushConfigError("payload_too_large");
  let serverPrivate: CryptoKey;
  let serverPublic: Bytes;
  if (options.serverKeys) {
    serverPrivate = options.serverKeys.privateKey;
    serverPublic = options.serverKeys.publicKey;
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    serverPrivate = pair.privateKey;
    serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new WebPushConfigError("salt");

  const userAgentPublic = await crypto.subtle.importKey("raw", keys.p256dh, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userAgentPublic }, serverPrivate, 256));

  // RFC 8291 §3.4: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concat(encoder.encode("WebPush: info\0"), keys.p256dh, serverPublic);
  const ikm = await hkdf(keys.auth, ecdhSecret, keyInfo, 32);
  // RFC 8188 §2.2/2.3: content-encryption key and nonce.
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // Single (last) record: plaintext followed by the 0x02 delimiter, no padding.
  const record = concat(plaintext, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record));

  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concat(header, ciphertext);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  payload: unknown;
  /** Seconds the push service may hold the message for an offline device. */
  ttlSeconds: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** ≤32 base64url characters; a later message with the same topic replaces an undelivered one. */
  topic?: string;
}

export type PushOutcome =
  | { kind: "sent"; status: number }
  /** 404/410: the subscription no longer exists; delete it. */
  | { kind: "gone"; status: number }
  /** 429/5xx/network: try again later. */
  | { kind: "retry"; status: number | null; retryAfterSeconds: number | null; code: string }
  /** Anything else, including any redirect: do not retry this delivery. */
  | { kind: "rejected"; status: number | null; code: string };

export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<PushOutcome>;
}

export class WebPushSender implements PushSender {
  private readonly keys: VapidKeys;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(keys: VapidKeys, fetcher: typeof fetch = fetch, options: { timeoutMs?: number; now?: () => Date } = {}) {
    this.keys = keys;
    this.fetcher = fetcher;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.now = options.now ?? (() => new Date());
  }

  async send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
    let endpoint: URL;
    let keys: SubscriptionKeys;
    try {
      // Re-validated at send time: the stored row is not trusted either.
      endpoint = validatePushEndpoint(target.endpoint);
      keys = await validateSubscriptionKeys(target.p256dh, target.auth);
    } catch (error) {
      return { kind: "rejected", status: null, code: error instanceof WebPushConfigError ? error.code : "invalid_subscription" };
    }
    if (message.topic !== undefined && !/^[A-Za-z0-9_-]{1,32}$/.test(message.topic)) {
      return { kind: "rejected", status: null, code: "invalid_topic" };
    }

    let body: Bytes;
    try {
      body = await encryptPayload(encoder.encode(JSON.stringify(message.payload)), keys);
    } catch (error) {
      return { kind: "rejected", status: null, code: error instanceof WebPushConfigError ? error.code : "encrypt_failed" };
    }
    const headers: Record<string, string> = {
      Authorization: await vapidAuthorizationCached(this.keys, endpoint, this.now()),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(Math.max(0, Math.floor(message.ttlSeconds))),
      Urgency: message.urgency ?? "normal",
    };
    if (message.topic) headers.Topic = message.topic;

    let response: Response;
    try {
      response = await this.fetcher(endpoint.toString(), {
        method: "POST",
        headers,
        body,
        // An endpoint that redirects is not trusted to choose where the
        // Worker sends next; a redirect is a terminal rejection.
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return { kind: "retry", status: null, retryAfterSeconds: null, code: "network" };
    }
    // Never read or retain the body; push services may echo identifiers.
    void response.body?.cancel().catch(() => undefined);

    const status = response.status;
    if (response.type === "opaqueredirect" || (status >= 300 && status < 400)) {
      return { kind: "rejected", status: status || null, code: "redirect_refused" };
    }
    if (status >= 200 && status < 300) return { kind: "sent", status };
    if (status === 404 || status === 410) return { kind: "gone", status };
    if (status === 429 || status >= 500 || status === 408) {
      return { kind: "retry", status, retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")), code: `http_${status}` };
    }
    return { kind: "rejected", status, code: `http_${status}` };
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 3600);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.min(Math.max(0, Math.round((date - Date.now()) / 1000)), 3600);
  return null;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface WebPushEnv {
  WEB_PUSH_ENABLED?: string;
  WEB_PUSH_VAPID_PUBLIC_KEY?: string;
  WEB_PUSH_VAPID_PRIVATE_KEY?: string;
  WEB_PUSH_SUBJECT?: string;
}

/** Null unless the explicit flag is on and every key is present and valid. */
export async function loadWebPushConfig(env: WebPushEnv): Promise<VapidKeys | null> {
  if (env.WEB_PUSH_ENABLED !== "true") return null;
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  try {
    return await importVapidKeys(publicKey, privateKey, subject);
  } catch {
    return null;
  }
}
