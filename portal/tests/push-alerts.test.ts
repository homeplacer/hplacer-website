import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { handleRequest } from "../src/app.ts";
import { notify } from "../src/domain/notifications.ts";
import { DELIVERY_WINDOW_MS, dispatchPushOutbox, MAX_DELIVERY_ATTEMPTS, runWebPush, type PushDispatchSummary } from "../src/domain/push.ts";
import { assignTask, createTask } from "../src/domain/tasks.ts";
import { clearVapidTokenCache, importVapidKeys, WebPushSender, type PushSender } from "../src/integrations/web-push.ts";
import { nowIso } from "../src/platform/ids.ts";
import { createHarness, identityFor, type Harness } from "./harness.ts";
import {
  decryptPush,
  enablePush,
  fakeDevice,
  ORIGIN,
  pushPost,
  recordingFetch,
  subscriptionBody,
  type FakeDevice,
  type VapidFixture,
} from "./push-helpers.ts";

interface DeliveryRow {
  id: string;
  notification_id: string;
  subscription_id: string | null;
  employee_id: string;
  status: string;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
}

async function deliveries(harness: Harness): Promise<DeliveryRow[]> {
  const rows = await harness.db.prepare("SELECT * FROM push_deliveries ORDER BY created_at, id").all<DeliveryRow>();
  return rows.results;
}

async function subscribe(harness: Harness, as: string, device: FakeDevice): Promise<Response> {
  return harness.request("/api/push/subscriptions", { ...pushPost(subscriptionBody(device)), as });
}

/** Ages every queued row so the window/backoff logic can be driven from a fixed clock. */
async function setCreated(harness: Harness, when: Date): Promise<void> {
  await harness.db.prepare("UPDATE push_deliveries SET created_at = ?, next_attempt_at = ?").bind(nowIso(when), nowIso(when)).run();
}

describe("phone alert subscriptions", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
    clearVapidTokenCache();
  });
  afterEach(() => harness.close());

  it("stays off until configured: no script, no subscriptions, no outbox rows", async () => {
    const config = await harness.json<{ enabled: boolean; publicKey: string | null }>("/api/push/config");
    assert.deepEqual(config, { enabled: false, publicKey: null });
    const response = await subscribe(harness, "dale@hplacer.com", fakeDevice());
    assert.equal(response.status, 503);
    const page = await harness.request("/notifications", { as: "dale@hplacer.com" });
    const html = await page.text();
    assert.ok(!html.includes("/push-client.js"));
    assert.ok(!(page.headers.get("Content-Security-Policy") ?? "").includes("script-src"));
    assert.match(html, /not turned on for the portal yet/);

    const actor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, actor, { title: "Set blocks", assignedToIds: ["emp_dale"] });
    assert.equal((await deliveries(harness)).length, 0);
    assert.equal((await runWebPush(harness.env, recordingFetch().fetcher)).enabled, false);
  });

  it("requires a same-origin JSON request for every change", async () => {
    await enablePush(harness.env);
    const device = fakeDevice();
    const body = JSON.stringify(subscriptionBody(device));
    const json = { "Content-Type": "application/json", Accept: "application/json" };
    const attempts: [RequestInit, number][] = [
      [{ method: "POST", headers: json, body }, 403],
      [{ method: "POST", headers: { ...json, Origin: "https://evil.example" }, body }, 403],
      [{ method: "POST", headers: { ...json, Origin: ORIGIN, "Sec-Fetch-Site": "cross-site" }, body }, 403],
      [{ method: "POST", headers: { "Content-Type": "text/plain", Accept: "application/json", Origin: ORIGIN }, body }, 415],
      [{ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Origin: ORIGIN }, body: `endpoint=${encodeURIComponent(device.endpoint)}` }, 415],
    ];
    for (const [init, status] of attempts) {
      const response = await harness.request("/api/push/subscriptions", { ...init, as: "dale@hplacer.com" });
      assert.equal(response.status, status);
    }
    for (const path of ["/api/push/test", "/api/push/subscriptions/remove", "/api/push/subscriptions/check"]) {
      const response = await harness.request(path, { method: "POST", headers: json, body: "{}", as: "dale@hplacer.com" });
      assert.equal(response.status, 403, path);
    }
    const formDelete = await harness.request("/api/push/devices/psub_x/delete", { method: "POST", headers: { Origin: "https://evil.example" }, as: "dale@hplacer.com" });
    assert.equal(formDelete.status, 403);
    assert.equal((await harness.db.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>())?.n, 0);
  });

  it("refuses people who are not active employees, including for the app shell files", async () => {
    await enablePush(harness.env);
    const stranger = await harness.request("/api/push/subscriptions", { ...pushPost(subscriptionBody(fakeDevice())), as: "stranger@example.com" });
    assert.ok(stranger.status === 401 || stranger.status === 403);
    for (const path of ["/sw.js", "/manifest.webmanifest", "/push-client.js", "/apple-touch-icon.png"]) {
      const response = await harness.request(path, { as: "stranger@example.com" });
      assert.ok(response.status === 401 || response.status === 403, path);
    }
  });

  it("validates endpoints and keys and never echoes them back", async () => {
    const vapid = await enablePush(harness.env);
    for (const endpoint of ["http://web.push.apple.com/x", "https://127.0.0.1/x", "https://portal.hplacer.com/api/tasks", "https://web.push.apple.com.evil.example/x"]) {
      const response = await subscribe(harness, "dale@hplacer.com", { ...fakeDevice(), endpoint });
      assert.equal(response.status, 400, endpoint);
    }
    const badKey = await subscribe(harness, "dale@hplacer.com", { ...fakeDevice(), auth: "AAAA" });
    assert.equal(badKey.status, 400);
    assert.equal((await harness.db.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>())?.n, 0);

    const device = fakeDevice();
    const created = await subscribe(harness, "dale@hplacer.com", device);
    assert.equal(created.status, 201);
    const text = await created.text();
    assert.ok(!text.includes(device.endpoint) && !text.includes(device.p256dh) && !text.includes(device.auth));
    assert.equal((await subscribe(harness, "dale@hplacer.com", device)).status, 200, "re-subscribing is idempotent");

    const config = await harness.json<{ enabled: boolean; publicKey: string }>("/api/push/config", { as: "dale@hplacer.com" });
    assert.deepEqual(config, { enabled: true, publicKey: vapid.publicKey });
    assert.ok(!JSON.stringify(config).includes(vapid.privateKey));

    const page = await harness.request("/notifications", { as: "dale@hplacer.com" });
    const html = await page.text();
    assert.match(html, /\/push-client\.js/);
    assert.match(page.headers.get("Content-Security-Policy") ?? "", /script-src 'self'/);
    assert.ok(!(page.headers.get("Content-Security-Policy") ?? "").includes("unsafe-inline'; script") );
    assert.match(html, /iPhone, iPad, or Mac \(Apple\)/);
    for (const secret of [device.endpoint, device.p256dh, device.auth, vapid.privateKey]) assert.ok(!html.includes(secret));
    assert.match(html, /data-push-on hidden/);
  });

  it("keeps each employee's devices private", async () => {
    await enablePush(harness.env);
    const dale = fakeDevice();
    const created = await (await subscribe(harness, "dale@hplacer.com", dale)).json() as { id: string };

    const check = await harness.json<{ registered: boolean }>("/api/push/subscriptions/check", { ...pushPost({ endpoint: dale.endpoint }), as: "marcus@hplacer.com" });
    assert.equal(check.registered, false, "another employee cannot tell whose endpoint it is");
    const removed = await harness.json<{ removed: boolean }>("/api/push/subscriptions/remove", { ...pushPost({ endpoint: dale.endpoint }), as: "marcus@hplacer.com" });
    assert.equal(removed.removed, false);
    const byId = await harness.request(`/api/push/devices/${created.id}/delete`, { method: "POST", headers: { Origin: ORIGIN, Accept: "application/json" }, as: "marcus@hplacer.com" });
    assert.equal(byId.status, 404);
    const adminById = await harness.request(`/api/push/devices/${created.id}/delete`, { method: "POST", headers: { Origin: ORIGIN, Accept: "application/json" }, as: "ops@hplacer.com" });
    assert.equal(adminById.status, 404, "not even an administrator can remove someone else's device");
    const marcusPage = await (await harness.request("/notifications", { as: "marcus@hplacer.com" })).text();
    assert.ok(!marcusPage.includes(created.id));

    assert.equal((await harness.json<{ registered: boolean }>("/api/push/subscriptions/check", { ...pushPost({ endpoint: dale.endpoint }), as: "dale@hplacer.com" })).registered, true);
    const own = await harness.request(`/api/push/devices/${created.id}/delete`, { method: "POST", headers: { Origin: ORIGIN }, as: "dale@hplacer.com" });
    assert.equal(own.status, 303);
    assert.equal((await harness.db.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>())?.n, 0);
  });

  it("moves a shared device to the new account so one endpoint never alerts two people", async () => {
    await enablePush(harness.env);
    const phone = fakeDevice();
    await subscribe(harness, "dale@hplacer.com", phone);
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "Dale's task", assignedToIds: ["emp_dale"] });
    assert.equal((await deliveries(harness)).filter((row) => row.status === "pending").length, 1);

    const switched = await subscribe(harness, "marcus@hplacer.com", phone);
    assert.equal(switched.status, 201);
    assert.equal(((await switched.json()) as { transferred: boolean }).transferred, true);
    const rows = await harness.db.prepare("SELECT employee_id FROM push_subscriptions").all<{ employee_id: string }>();
    assert.deepEqual(rows.results.map((row) => row.employee_id), ["emp_marcus"]);
    const queued = await deliveries(harness);
    assert.equal(queued[0].status, "cancelled", "Dale's queued alert does not go to Marcus's phone");

    const { calls, fetcher } = recordingFetch();
    const summary = await runWebPush(harness.env, fetcher);
    assert.equal(summary.sent, 0);
    assert.equal(calls.length, 0);
    assert.equal((await harness.json<{ registered: boolean }>("/api/push/subscriptions/check", { ...pushPost({ endpoint: phone.endpoint }), as: "dale@hplacer.com" })).registered, false);
  });
});

describe("task-assignment push outbox", () => {
  let harness: Harness;
  let vapid: VapidFixture;
  beforeEach(async () => {
    harness = await createHarness();
    clearVapidTokenCache();
    vapid = await enablePush(harness.env);
  });
  afterEach(() => harness.close());

  async function sender(fetcher: typeof fetch): Promise<PushSender> {
    return new WebPushSender(await importVapidKeys(vapid.publicKey, vapid.privateKey, "mailto:ops@hplacer.com"), fetcher);
  }

  it("alerts every assignee's devices, including self-assignment, with a generic same-origin payload", async () => {
    const brandonPhone = fakeDevice();
    const dalePhone = fakeDevice();
    const daleChrome = fakeDevice("fcm.googleapis.com");
    const marcusPhone = fakeDevice();
    await subscribe(harness, "brandon@hplacer.com", brandonPhone);
    await subscribe(harness, "dale@hplacer.com", dalePhone);
    await subscribe(harness, "dale@hplacer.com", daleChrome);
    await subscribe(harness, "marcus@hplacer.com", marcusPhone);

    const created = await harness.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ title: "Pour footers at 41 Ridge Rd for the Smith family", priority: "urgent", assigned_to: ["emp_brandon", "emp_dale"] }),
      as: "brandon@hplacer.com",
    });
    assert.equal(created.status, 201);
    const { id: taskId } = (await created.json()) as { id: string };

    // In-app bell and email eligibility are unchanged.
    const bell = await harness.db.prepare("SELECT employee_id, email_eligible FROM notifications WHERE related_id = ? ORDER BY employee_id").bind(taskId)
      .all<{ employee_id: string; email_eligible: number }>();
    assert.deepEqual(bell.results.map((row) => ({ ...row })), [{ employee_id: "emp_brandon", email_eligible: 1 }, { employee_id: "emp_dale", email_eligible: 1 }]);

    const queued = await deliveries(harness);
    assert.equal(queued.length, 3, "Brandon's phone plus both of Dale's devices; Marcus is not assigned");
    assert.ok(queued.every((row) => row.status === "pending"));

    const { calls, fetcher } = recordingFetch();
    const summary = await dispatchPushOutbox(harness.db, await sender(fetcher));
    assert.equal(summary.sent, 3);
    assert.deepEqual(new Set(calls.map((call) => call.url)), new Set([brandonPhone.endpoint, dalePhone.endpoint, daleChrome.endpoint]));

    const byEndpoint = new Map([brandonPhone, dalePhone, daleChrome].map((device) => [device.endpoint, device]));
    const tags = new Set<string>();
    for (const call of calls) {
      const payload = JSON.parse(decryptPush(call.body, byEndpoint.get(call.url)!));
      assert.equal(payload.title, "Home Placer");
      assert.equal(payload.body, "You have a new urgent task assignment.");
      assert.equal(payload.url, `/tasks/${taskId}`);
      const plaintext = JSON.stringify(payload);
      for (const leak of ["Ridge", "Smith", "Pour", "Brandon", "Dale"]) assert.ok(!plaintext.includes(leak), leak);
      assert.match(payload.tag, /^ntf-ntf_[a-z0-9]+$/);
      tags.add(payload.tag);
      assert.equal(call.headers.get("Urgency"), "high");
      assert.match(call.headers.get("Topic") ?? "", /^[A-Za-z0-9_-]{32}$/);
      assert.ok(Number(call.headers.get("TTL")) > 0);
    }
    assert.equal(tags.size, 2, "one tag per notification: Dale's two devices share his");

    const again = await dispatchPushOutbox(harness.db, await sender(fetcher));
    assert.equal(again.sent, 0, "already-sent rows are never resent");
    assert.equal(calls.length, 3);
  });

  it("queues alerts only for newly added assignees on reassignment, and not for completion notices", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    await subscribe(harness, "marcus@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    const taskId = await createTask(harness.db, supervisor, { title: "Skirting", assignedToIds: ["emp_dale"] });
    await assignTask(harness.db, supervisor, taskId, ["emp_dale", "emp_marcus"]);
    const rows = await deliveries(harness);
    assert.deepEqual(rows.map((row) => row.employee_id).sort(), ["emp_dale", "emp_marcus"]);

    await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "Completed: Skirting", body: "Done", relatedType: "work_task", relatedId: taskId });
    await notify(harness.db, { employeeId: "emp_dale", category: "service_due", title: "Oil change", body: "Due" });
    assert.equal((await deliveries(harness)).length, 2);
  });

  it("does not replay history: earlier alerts never reach a device added later, and stale rows expire", async () => {
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "Before the phone was set up", assignedToIds: ["emp_dale"] });
    const device = fakeDevice();
    await subscribe(harness, "dale@hplacer.com", device);
    assert.equal((await deliveries(harness)).length, 0);

    await createTask(harness.db, supervisor, { title: "Queued while push was down", assignedToIds: ["emp_dale"] });
    const created = new Date("2026-10-12T00:00:00Z");
    await setCreated(harness, created);
    const { calls, fetcher } = recordingFetch();
    const summary = await dispatchPushOutbox(harness.db, await sender(fetcher), { now: new Date(created.getTime() + DELIVERY_WINDOW_MS + 60_000) });
    assert.equal(summary.expired, 1);
    assert.equal(calls.length, 0);
    assert.equal((await deliveries(harness))[0].status, "expired");
  });

  it("rechecks the employee and the assignment at send time", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    await subscribe(harness, "marcus@hplacer.com", fakeDevice());
    await subscribe(harness, "wes@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    const reassigned = await createTask(harness.db, supervisor, { title: "Moved to Nina", assignedToIds: ["emp_dale"] });
    const cancelled = await createTask(harness.db, supervisor, { title: "Called off", assignedToIds: ["emp_marcus"] });
    await createTask(harness.db, supervisor, { title: "Wes leaves", assignedToIds: ["emp_wes"] });

    await assignTask(harness.db, supervisor, reassigned, ["emp_nina"]);
    await harness.db.prepare("UPDATE work_tasks SET status = 'cancelled' WHERE id = ?").bind(cancelled).run();
    await harness.db.prepare("UPDATE employees SET active = 0 WHERE id = 'emp_wes'").run();

    const { calls, fetcher } = recordingFetch();
    const summary = await dispatchPushOutbox(harness.db, await sender(fetcher));
    assert.equal(summary.skipped, 3);
    assert.equal(calls.length, 0);
    const reasons = (await deliveries(harness)).map((row) => row.last_error).sort();
    assert.deepEqual(reasons, ["employee_inactive", "no_longer_assigned", "no_longer_assigned"]);
  });

  it("backs off transient failures, honours Retry-After, and gives up after the attempt limit", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "Retry me", assignedToIds: ["emp_dale"] });
    const t0 = new Date("2026-10-12T12:00:00Z");
    await setCreated(harness, t0);

    const { calls, fetcher } = recordingFetch((_push, index) =>
      new Response(null, { status: index === 0 ? 429 : 503, headers: index === 0 ? { "Retry-After": "900" } : {} }));
    const push = await sender(fetcher);

    let summary = await dispatchPushOutbox(harness.db, push, { now: t0 });
    assert.equal(summary.retried, 1);
    let [row] = await deliveries(harness);
    assert.equal(row.status, "pending");
    assert.equal(row.next_attempt_at, nowIso(new Date(t0.getTime() + 900_000)), "Retry-After beats the 1-minute first backoff");
    assert.equal(row.last_error, "http_429");

    summary = await dispatchPushOutbox(harness.db, push, { now: new Date(t0.getTime() + 60_000) });
    assert.equal(calls.length, 1, "not resent before it is due");

    let clock = t0.getTime();
    for (let attempt = 2; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      clock += 61 * 60_000; // past every backoff step, well inside the delivery window
      summary = await dispatchPushOutbox(harness.db, push, { now: new Date(clock) });
    }
    [row] = await deliveries(harness);
    assert.equal(row.attempts, MAX_DELIVERY_ATTEMPTS);
    assert.equal(row.status, "failed");
    assert.equal(calls.length, MAX_DELIVERY_ATTEMPTS);
    const device = await harness.db.prepare("SELECT failure_count FROM push_subscriptions").first<{ failure_count: number }>();
    assert.equal(device?.failure_count, MAX_DELIVERY_ATTEMPTS);
    for (const r of await deliveries(harness)) assert.ok(!(r.last_error ?? "").includes("push.apple.com"));
  });

  it("deletes an expired endpoint (410) and cancels its other queued alerts", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "One", assignedToIds: ["emp_dale"] });
    await createTask(harness.db, supervisor, { title: "Two", assignedToIds: ["emp_dale"] });
    const { calls, fetcher } = recordingFetch(() => new Response(null, { status: 410 }));
    const summary = await dispatchPushOutbox(harness.db, await sender(fetcher));
    assert.equal(summary.gone, 1);
    assert.equal(calls.length, 1, "the second alert is not sent to a dead endpoint");
    assert.deepEqual((await deliveries(harness)).map((row) => row.status), ["gone", "cancelled"]);
    assert.equal((await harness.db.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>())?.n, 0);
  });

  it("sends each alert once when two drains run at the same time", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    await subscribe(harness, "marcus@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "Race", assignedToIds: ["emp_dale", "emp_marcus"] });
    const { calls, fetcher } = recordingFetch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(null, { status: 201 });
    });
    const push = await sender(fetcher);
    const results = await Promise.all([dispatchPushOutbox(harness.db, push), dispatchPushOutbox(harness.db, push)]);
    assert.equal(results.reduce((sum, r) => sum + r.sent, 0), 2);
    assert.equal(calls.length, 2);
  });

  it("fences a stale sender: a reclaimed lease's outcome is not overwritten by the first sender", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "Slow network", assignedToIds: ["emp_dale"] });
    const t0 = new Date("2026-10-12T12:00:00Z");
    await setCreated(harness, t0);

    let reclaimed: PushDispatchSummary | null = null;
    const slowSender: PushSender = {
      async send() {
        // While the first send hangs past its lease, a later drain reclaims and delivers.
        const fast = recordingFetch();
        reclaimed = await dispatchPushOutbox(harness.db, await sender(fast.fetcher), { now: new Date(t0.getTime() + 5 * 60_000) });
        return { kind: "retry", status: 503, retryAfterSeconds: null, code: "http_503" };
      },
    };
    const first = await dispatchPushOutbox(harness.db, slowSender, { now: t0 });
    assert.equal(reclaimed!.sent, 1);
    assert.equal(first.retried, 0, "the stale outcome is discarded");
    const [row] = await deliveries(harness);
    assert.equal(row.status, "sent");
    assert.equal(row.attempts, 2);
    const device = await harness.db.prepare("SELECT failure_count, last_success_at FROM push_subscriptions").first<{ failure_count: number; last_success_at: string | null }>();
    assert.equal(device?.failure_count, 0, "a fenced-out failure does not mark the device");
    assert.ok(device?.last_success_at);
  });

  it("reads a fresh clock per row so a slow send does not hand later rows an expired lease", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    await createTask(harness.db, supervisor, { title: "First", assignedToIds: ["emp_dale"] });
    await createTask(harness.db, supervisor, { title: "Second", assignedToIds: ["emp_dale"] });
    let clock = new Date("2026-10-12T12:00:00Z").getTime();
    await setCreated(harness, new Date(clock));
    const leases: string[] = [];
    const push: PushSender = {
      async send() {
        const sending = await harness.db.prepare("SELECT lease_until FROM push_deliveries WHERE status = 'sending'").first<{ lease_until: string }>();
        leases.push(sending!.lease_until);
        clock += 5 * 60_000; // each send takes longer than a lease
        return { kind: "sent", status: 201 };
      },
    };
    const summary = await dispatchPushOutbox(harness.db, push, { now: () => new Date(clock) });
    assert.equal(summary.sent, 2);
    assert.ok(leases[1] > nowIso(new Date(clock - 5 * 60_000)), "the second claim's lease starts from its own clock");
  });

  it("stops claiming once the time budget is spent; the next drain picks up the rest", async () => {
    await subscribe(harness, "dale@hplacer.com", fakeDevice());
    const supervisor = await harness.actor("brandon@hplacer.com");
    for (const title of ["A", "B", "C"]) await createTask(harness.db, supervisor, { title, assignedToIds: ["emp_dale"] });
    const push: PushSender = {
      async send() {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { kind: "sent", status: 201 };
      },
    };
    const first = await dispatchPushOutbox(harness.db, push, { budgetMs: 10 });
    assert.equal(first.sent, 1);
    const rest = await dispatchPushOutbox(harness.db, push);
    assert.equal(rest.sent, 2);
  });

  it("starts delivery right after assignment through waitUntil", async () => {
    const device = fakeDevice();
    await subscribe(harness, "dale@hplacer.com", device);
    const { calls, fetcher } = recordingFetch();
    const pending: Promise<unknown>[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = fetcher;
    try {
      const response = await handleRequest(
        new Request(`${ORIGIN}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ title: "Now", assigned_to: ["emp_dale"] }),
        }),
        harness.env,
        { identity: identityFor("brandon@hplacer.com"), waitUntil: (promise) => pending.push(promise) },
      );
      assert.equal(response.status, 201);
      assert.equal(pending.length, 1);
      await Promise.all(pending);
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, device.endpoint);
    assert.equal((await deliveries(harness))[0].status, "sent");
  });
});

describe("test alert", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
    clearVapidTokenCache();
  });
  afterEach(() => harness.close());

  it("sends only to the caller's own devices, is rate limited, and drops dead endpoints", async () => {
    await enablePush(harness.env);
    const dale = fakeDevice();
    const daleOld = fakeDevice();
    const marcus = fakeDevice();
    await subscribe(harness, "dale@hplacer.com", dale);
    await subscribe(harness, "dale@hplacer.com", daleOld);
    await subscribe(harness, "marcus@hplacer.com", marcus);

    const { calls, fetcher } = recordingFetch((push) => new Response(null, { status: push.url === daleOld.endpoint ? 410 : 201 }));
    const realFetch = globalThis.fetch;
    globalThis.fetch = fetcher;
    try {
      const response = await harness.request("/api/push/test", { ...pushPost({}), as: "dale@hplacer.com" });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { devices: 2, sent: 1, failed: 0, removed: 1 });
      assert.deepEqual(calls.map((call) => call.url).sort(), [dale.endpoint, daleOld.endpoint].sort());
      const payload = JSON.parse(decryptPush(calls.find((call) => call.url === dale.endpoint)!.body, dale));
      assert.equal(payload.url, "/notifications");
      assert.match(payload.body, /Test alert/);

      const again = await harness.request("/api/push/test", { ...pushPost({}), as: "dale@hplacer.com" });
      assert.equal(again.status, 429);
      assert.equal(calls.length, 2);
    } finally {
      globalThis.fetch = realFetch;
    }
    const remaining = await harness.db.prepare("SELECT employee_id FROM push_subscriptions ORDER BY employee_id").all<{ employee_id: string }>();
    assert.deepEqual(remaining.results.map((row) => row.employee_id), ["emp_dale", "emp_marcus"]);
  });

  it("is unavailable until push is configured", async () => {
    const response = await harness.request("/api/push/test", { ...pushPost({}), as: "dale@hplacer.com" });
    assert.equal(response.status, 503);
  });
});

describe("installed app shell", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });
  afterEach(() => harness.close());

  it("serves a standalone manifest, PNG icons, and a service worker with no fetch handler", async () => {
    const manifest = await harness.request("/manifest.webmanifest");
    assert.match(manifest.headers.get("Content-Type") ?? "", /application\/manifest\+json/);
    const data = await manifest.json() as { display: string; id: string; start_url: string; icons: { src: string }[] };
    assert.equal(data.display, "standalone");
    assert.equal(data.id, "/");
    for (const path of ["/apple-touch-icon.png", ...data.icons.map((icon) => icon.src)]) {
      const icon = await harness.request(path);
      assert.equal(icon.status, 200, path);
      assert.equal(icon.headers.get("Content-Type"), "image/png");
      assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    }

    const sw = await harness.request("/sw.js");
    assert.match(sw.headers.get("Content-Type") ?? "", /text\/javascript/);
    const source = await sw.text();
    assert.ok(!/addEventListener\("fetch"/.test(source), "no request interception, so Access sign-in is never bypassed or cached");
    assert.ok(!/fetch\(/.test(source), "shows notifications from the payload alone");
    assert.match(source, /showNotification/);
    assert.match(source, /url\.origin !== self\.location\.origin/);

    const home = await harness.request("/");
    const html = await home.text();
    assert.match(html, /<link rel="manifest" href="\/manifest.webmanifest" crossorigin="use-credentials">/);
    assert.match(html, /apple-touch-icon/);
    assert.ok(!html.includes("<script"), "pages other than notifications still run no script");
    assert.ok(!(home.headers.get("Content-Security-Policy") ?? "").includes("script-src"));
    assert.match(home.headers.get("Content-Security-Policy") ?? "", /manifest-src 'self'/);
  });

  it("keeps the service worker's click target on the portal origin", async () => {
    const source = await (await harness.request("/sw.js")).text();
    // Evaluate the worker's own safePath against hostile inputs.
    const safePath = new Function("self", `${source.split('self.addEventListener("install"')[0]}; return safePath;`)({ location: { origin: "https://portal.hplacer.com" } }) as (value: unknown) => string;
    assert.equal(safePath("/tasks/tsk_1"), "/tasks/tsk_1");
    for (const hostile of ["https://evil.example/", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", 42, null]) {
      assert.equal(safePath(hostile), "/notifications", String(hostile));
    }
  });
});
