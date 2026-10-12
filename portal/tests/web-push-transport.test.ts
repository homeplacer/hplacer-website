import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import {
  base64UrlDecode,
  base64UrlEncode,
  clearVapidTokenCache,
  encryptPayload,
  importVapidKeys,
  loadWebPushConfig,
  MAX_PLAINTEXT_BYTES,
  validatePushEndpoint,
  validateSubscriptionKeys,
  vapidAuthorizationCached,
  WebPushSender,
} from "../src/integrations/web-push.ts";
import { decryptPush, fakeDevice, recordingFetch, vapidFixture } from "./push-helpers.ts";

const encoder = new TextEncoder();

describe("RFC 8291 payload encryption", () => {
  it("reproduces the RFC 8291 Appendix A published test vector byte for byte", async () => {
    const asPublic = base64UrlDecode("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    const asPrivate = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
        x: base64UrlEncode(asPublic.slice(1, 33)),
        y: base64UrlEncode(asPublic.slice(33)),
      },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    const body = await encryptPayload(
      encoder.encode("When I grow up, I want to be a watermelon"),
      {
        p256dh: base64UrlDecode("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
        auth: base64UrlDecode("BTBZMqHH6r4Tts7J_aSIgg"),
      },
      { serverKeys: { privateKey: asPrivate, publicKey: asPublic }, salt: base64UrlDecode("DGv6ra1nlYgDCS1FRnbzlw") },
    );
    assert.equal(
      base64UrlEncode(body),
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("produces payloads an independent OpenSSL implementation decrypts, with fresh keys and salt each time", async () => {
    const device = fakeDevice();
    const keys = await validateSubscriptionKeys(device.p256dh, device.auth);
    const first = await encryptPayload(encoder.encode('{"hello":"phone"}'), keys);
    const second = await encryptPayload(encoder.encode('{"hello":"phone"}'), keys);
    assert.equal(decryptPush(first, device), '{"hello":"phone"}');
    assert.equal(decryptPush(second, device), '{"hello":"phone"}');
    assert.notDeepEqual(first.slice(0, 16), second.slice(0, 16), "salt is random per message");
    assert.notDeepEqual(first.slice(21, 86), second.slice(21, 86), "ephemeral key is fresh per message");
  });

  it("refuses payloads that do not fit one 4096-byte record", async () => {
    const device = fakeDevice();
    const keys = await validateSubscriptionKeys(device.p256dh, device.auth);
    const fits = await encryptPayload(new Uint8Array(MAX_PLAINTEXT_BYTES), keys);
    assert.equal(fits.length, 4096);
    await assert.rejects(encryptPayload(new Uint8Array(MAX_PLAINTEXT_BYTES + 1), keys), /payload_too_large/);
  });
});

describe("VAPID (RFC 8292)", () => {
  beforeEach(() => clearVapidTokenCache());

  it("signs an ES256 JWT that Node's verifier accepts, scoped to the push service origin", async () => {
    const vapid = await vapidFixture();
    const keys = await importVapidKeys(vapid.publicKey, vapid.privateKey, "mailto:ops@hplacer.com");
    const now = new Date("2026-10-12T15:00:00Z");
    const header = await vapidAuthorizationCached(keys, new URL("https://web.push.apple.com/abc"), now);
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    assert.ok(match);
    const [, head, claims, signature, k] = match;
    assert.equal(k, vapid.publicKey);
    assert.deepEqual(JSON.parse(Buffer.from(head, "base64url").toString()), { typ: "JWT", alg: "ES256" });
    const body = JSON.parse(Buffer.from(claims, "base64url").toString());
    assert.equal(body.aud, "https://web.push.apple.com");
    assert.equal(body.sub, "mailto:ops@hplacer.com");
    const lifetime = body.exp - now.getTime() / 1000;
    assert.ok(lifetime > 3600 && lifetime <= 24 * 3600, "expiry within the 24-hour ceiling");

    const publicKey = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: Buffer.from(base64UrlDecode(vapid.publicKey).slice(1, 33)).toString("base64url"), y: Buffer.from(base64UrlDecode(vapid.publicKey).slice(33)).toString("base64url") },
      format: "jwk",
    });
    assert.ok(verify("sha256", Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")));
  });

  it("reuses one token per push origin for at least an hour and refreshes before it expires", async () => {
    const vapid = await vapidFixture();
    const keys = await importVapidKeys(vapid.publicKey, vapid.privateKey, "mailto:ops@hplacer.com");
    const apple = new URL("https://web.push.apple.com/a");
    const t0 = new Date("2026-10-12T00:00:00Z");
    const first = await vapidAuthorizationCached(keys, apple, t0);
    assert.equal(await vapidAuthorizationCached(keys, new URL("https://web.push.apple.com/other"), new Date(t0.getTime() + 61 * 60_000)), first);
    assert.equal(await vapidAuthorizationCached(keys, apple, new Date(t0.getTime() + 10 * 3600_000)), first);
    assert.notEqual(await vapidAuthorizationCached(keys, new URL("https://fcm.googleapis.com/x"), t0), first, "audience differs per origin");
    assert.notEqual(await vapidAuthorizationCached(keys, apple, new Date(t0.getTime() + 11.5 * 3600_000)), first, "refreshed with under an hour left");
  });

  it("refuses a mismatched key pair, a bad subject, and stays off unless explicitly enabled", async () => {
    const a = await vapidFixture();
    const b = await vapidFixture();
    await assert.rejects(importVapidKeys(a.publicKey, b.privateKey, "mailto:ops@hplacer.com"), /vapid_key_mismatch|vapid_keys/);
    await assert.rejects(importVapidKeys(a.publicKey, a.privateKey, "ops@hplacer.com"), /vapid_subject/);
    const env = { WEB_PUSH_VAPID_PUBLIC_KEY: a.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: a.privateKey, WEB_PUSH_SUBJECT: "mailto:ops@hplacer.com" };
    assert.equal(await loadWebPushConfig(env), null);
    assert.equal(await loadWebPushConfig({ ...env, WEB_PUSH_ENABLED: "yes" }), null);
    assert.equal(await loadWebPushConfig({ ...env, WEB_PUSH_ENABLED: "true", WEB_PUSH_VAPID_PRIVATE_KEY: b.privateKey }), null);
    assert.ok(await loadWebPushConfig({ ...env, WEB_PUSH_ENABLED: "true" }));
  });
});

describe("push endpoint validation (SSRF boundary)", () => {
  it("accepts the HTTPS push services browsers use", () => {
    for (const endpoint of [
      "https://web.push.apple.com/QGuQyavXutnMH5dWjD2l",
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-by3p.notify.windows.com/w/?token=BQYAAAB",
    ]) {
      assert.equal(validatePushEndpoint(endpoint).protocol, "https:", endpoint);
    }
  });

  it("rejects anything that could point the Worker somewhere else", () => {
    for (const endpoint of [
      "http://web.push.apple.com/abc",
      "https://web.push.apple.com:8443/abc",
      "https://user:pw@web.push.apple.com/abc",
      "https://web.push.apple.com.evil.example/abc",
      "https://evilpush.apple.com/abc",
      "https://push.apple.com/abc",
      "https://127.0.0.1/abc",
      "https://[::1]/abc",
      "https://localhost/abc",
      "https://portal.hplacer.com/api/admin",
      "https://169.254.169.254/latest/meta-data",
      "https://web.push.apple.com/abc#frag",
      "https://web.push.apple.com\\@evil.example/",
      "javascript:alert(1)",
      `https://web.push.apple.com/${"a".repeat(1100)}`,
      "",
    ]) {
      assert.throws(() => validatePushEndpoint(endpoint), /Web Push/, endpoint);
    }
    assert.throws(() => validatePushEndpoint(42), /Web Push/);
  });

  it("rejects malformed or off-curve subscription keys", async () => {
    const device = fakeDevice();
    await assert.rejects(validateSubscriptionKeys(device.p256dh, "c2hvcnQ"), /auth/);
    await assert.rejects(validateSubscriptionKeys(device.p256dh.slice(0, 40), device.auth), /p256dh/);
    const offCurve = new Uint8Array(65);
    offCurve[0] = 4;
    offCurve[64] = 1;
    await assert.rejects(validateSubscriptionKeys(base64UrlEncode(offCurve), device.auth), /p256dh/);
    await assert.rejects(validateSubscriptionKeys("not base64!", device.auth), /base64url/);
  });
});

describe("WebPushSender", () => {
  beforeEach(() => clearVapidTokenCache());

  async function sender(respond?: Parameters<typeof recordingFetch>[0]) {
    const vapid = await vapidFixture();
    const keys = await importVapidKeys(vapid.publicKey, vapid.privateKey, "mailto:ops@hplacer.com");
    const recorder = recordingFetch(respond);
    return { ...recorder, sender: new WebPushSender(keys, recorder.fetcher) };
  }

  it("sends an encrypted aes128gcm request with TTL, urgency, topic, and manual redirects", async () => {
    const device = fakeDevice();
    const { calls, sender: push } = await sender();
    const outcome = await push.send(device, { payload: { title: "Home Placer" }, ttlSeconds: 600, urgency: "high", topic: "abcDEF123_-" });
    assert.deepEqual(outcome, { kind: "sent", status: 201 });
    assert.equal(calls.length, 1);
    const [call] = calls;
    assert.equal(call.url, device.endpoint);
    assert.equal(call.redirect, "manual");
    assert.equal(call.headers.get("Content-Encoding"), "aes128gcm");
    assert.equal(call.headers.get("Content-Type"), "application/octet-stream");
    assert.equal(call.headers.get("TTL"), "600");
    assert.equal(call.headers.get("Urgency"), "high");
    assert.equal(call.headers.get("Topic"), "abcDEF123_-");
    assert.match(call.headers.get("Authorization") ?? "", /^vapid t=.+, k=.+$/);
    assert.deepEqual(JSON.parse(decryptPush(call.body, device)), { title: "Home Placer" });
  });

  it("maps push service responses to sent, gone, retry, and rejected without following redirects", async () => {
    const cases: [Response | Error, string][] = [
      [new Response(null, { status: 410 }), "gone"],
      [new Response(null, { status: 404 }), "gone"],
      [new Response(null, { status: 429, headers: { "Retry-After": "120" } }), "retry"],
      [new Response(null, { status: 503 }), "retry"],
      [new Response(null, { status: 403 }), "rejected"],
      [new Response(null, { status: 413 }), "rejected"],
      [new Response(null, { status: 301, headers: { Location: "http://169.254.169.254/" } }), "rejected"],
      [new Error("network down"), "retry"],
    ];
    for (const [result, kind] of cases) {
      const { calls, sender: push } = await sender(() => {
        if (result instanceof Error) throw result;
        return result;
      });
      const outcome = await push.send(fakeDevice(), { payload: {}, ttlSeconds: 60 });
      assert.equal(outcome.kind, kind, String(result instanceof Error ? result.message : result.status));
      assert.equal(calls.length, 1, "a redirect is never followed with a second request");
      if (result instanceof Response && result.status === 429) {
        assert.equal(outcome.kind === "retry" && outcome.retryAfterSeconds, 120);
      }
      if (result instanceof Response && result.status === 301) {
        assert.equal(outcome.kind === "rejected" && outcome.code, "redirect_refused");
      }
    }
  });

  it("never contacts a stored endpoint that fails validation", async () => {
    const { calls, sender: push } = await sender();
    const device = fakeDevice();
    const outcome = await push.send({ ...device, endpoint: "https://169.254.169.254/latest" }, { payload: {}, ttlSeconds: 60 });
    assert.equal(outcome.kind, "rejected");
    assert.equal(calls.length, 0);
  });
});
