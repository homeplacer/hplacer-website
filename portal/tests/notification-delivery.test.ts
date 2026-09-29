import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notify } from "../src/domain/notifications.ts";
import {
  dispatchNotificationOutbox,
  NotificationDeliveryError,
  type NotificationDeliveryMessage,
} from "../src/domain/notification-delivery.ts";
import { createHarness } from "./harness.ts";
import { ResendTaskNotificationDispatcher, runTaskAssignmentEmail } from "../src/integrations/task-assignment-email.ts";

describe("provider-neutral notification delivery", () => {
  it("passes a stable idempotency key to a dispatcher and marks delivery", async () => {
    const harness = await createHarness();
    try {
      const id = await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "New task", body: "Check lot 4" });
      assert.ok(id);
      const messages: NotificationDeliveryMessage[] = [];
      const result = await dispatchNotificationOutbox(harness.db, { send: async (message) => { messages.push(message); } });
      assert.equal(result.sent, 1);
      assert.equal(messages[0].id, id);
      const row = await harness.db.prepare("SELECT delivered_at FROM notifications WHERE id = ?").bind(id).first<{ delivered_at: string | null }>();
      assert.ok(row?.delivered_at);
    } finally {
      harness.close();
    }
  });

  it("backs off transient failures without storing recipient data in the error", async () => {
    const harness = await createHarness();
    try {
      const id = await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "New task", body: "Check lot 4" });
      assert.ok(id);
      const result = await dispatchNotificationOutbox(
        harness.db,
        { send: async () => { throw new NotificationDeliveryError("timeout for dale@hplacer.com or 828-555-0199"); } },
        { now: new Date("2026-08-31T12:00:00Z") },
      );
      assert.equal(result.retried, 1);
      const row = await harness.db
        .prepare("SELECT delivery_attempts, next_delivery_at, last_delivery_error FROM notifications WHERE id = ?")
        .bind(id)
        .first<{ delivery_attempts: number; next_delivery_at: string | null; last_delivery_error: string }>();
      assert.equal(row?.delivery_attempts, 1);
      assert.ok(row?.next_delivery_at);
      assert.ok(!row?.last_delivery_error.includes("dale@hplacer.com"));
      assert.ok(!row?.last_delivery_error.includes("828-555-0199"));
    } finally {
      harness.close();
    }
  });

  it("limits email delivery to new task-assignment notifications after the activation watermark", async () => {
    const harness = await createHarness();
    try {
      const olderTask = await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "Old task", body: "Old alert" });
      const newTask = await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "New task", body: "New alert", relatedType: "work_task", relatedId: "tsk_123", emailEligible: true });
      const bellOnlyTask = await notify(harness.db, { employeeId: "emp_dale", category: "task_assigned", title: "Bell only", body: "No email requested" });
      const otherNotice = await notify(harness.db, { employeeId: "emp_dale", category: "service_due", title: "Service due", body: "Not an assignment" });
      assert.ok(olderTask && newTask && bellOnlyTask && otherNotice);
      await harness.db.prepare("UPDATE notifications SET created_at = ? WHERE id = ?").bind("2026-09-01 00:00:00", olderTask).run();
      await harness.db.prepare("UPDATE notifications SET created_at = ? WHERE id = ?").bind("2026-09-29 12:01:00", newTask).run();
      const messages: NotificationDeliveryMessage[] = [];
      const result = await dispatchNotificationOutbox(
        harness.db,
        { send: async (message) => { messages.push(message); } },
        { categories: ["task_assigned"], createdAfter: "2026-09-29T12:00:00.000Z", emailEligibleOnly: true },
      );
      assert.deepEqual(result, { sent: 1, retried: 0, failed: 0 });
      assert.equal(messages[0]?.title, "New task");
      assert.equal(messages[0]?.taskUrl, "https://portal.hplacer.com/tasks/tsk_123");
      const oldRow = await harness.db.prepare("SELECT delivered_at FROM notifications WHERE id = ?").bind(olderTask).first<{ delivered_at: string | null }>();
      const bellOnlyRow = await harness.db.prepare("SELECT delivered_at FROM notifications WHERE id = ?").bind(bellOnlyTask).first<{ delivered_at: string | null }>();
      const unrelatedRow = await harness.db.prepare("SELECT delivered_at FROM notifications WHERE id = ?").bind(otherNotice).first<{ delivered_at: string | null }>();
      assert.equal(oldRow?.delivered_at, null);
      assert.equal(bellOnlyRow?.delivered_at, null);
      assert.equal(unrelatedRow?.delivered_at, null);
    } finally {
      harness.close();
    }
  });

  it("sends a plain-text task email with a stable idempotency key", async () => {
    let captured: Request | undefined;
    const dispatcher = new ResendTaskNotificationDispatcher("key-not-logged", "Home Placer <alerts@example.com>", async (input, init) => {
      captured = new Request(input, init);
      return new Response(null, { status: 200 });
    });
    await dispatcher.send({
      id: "notice-1",
      recipientEmail: "employee@example.com",
      title: "Fix pump",
      body: "You assigned yourself this task.",
      severity: "info",
      taskUrl: "https://portal.hplacer.com/tasks/task-1",
    });
    assert.ok(captured);
    assert.equal(captured.headers.get("Idempotency-Key"), "notice-1");
    assert.equal(captured.headers.get("Authorization"), "Bearer key-not-logged");
    const body = await captured.json() as { from: string; to: string[]; subject: string; text: string };
    assert.equal(body.from, "Home Placer <alerts@example.com>");
    assert.deepEqual(body.to, ["employee@example.com"]);
    assert.equal(body.subject, "Home Placer task assigned: Fix pump");
    assert.match(body.text, /Open the task: https:\/\/portal\.hplacer\.com\/tasks\/task-1/);
  });

  it("leaves task emails disabled unless explicitly enabled and complete", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, {
        TASK_EMAIL_NOTIFICATIONS_ENABLED: "true",
        RESEND_API_KEY: "test-key",
        TASK_NOTIFICATION_FROM: "Home Placer <alerts@example.com>",
      });
      const result = await runTaskAssignmentEmail(harness.env);
      assert.deepEqual(result, { enabled: false, sent: 0, retried: 0, failed: 0 });
    } finally {
      harness.close();
    }
  });

  it("uses the Resend API only when the explicit feature flag and full configuration are present", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, {
        TASK_EMAIL_NOTIFICATIONS_ENABLED: "true",
        RESEND_API_KEY: "test-key",
        TASK_NOTIFICATION_FROM: "Home Placer <alerts@example.com>",
        TASK_EMAIL_START_AFTER: "2000-01-01T00:00:00.000Z",
      });
      const taskId = await notify(harness.db, {
        employeeId: "emp_dale", category: "task_assigned", title: "Assigned task", body: "You assigned yourself this task.",
        relatedType: "work_task", relatedId: "tsk_456", emailEligible: true,
      });
      assert.ok(taskId);
      const requests: Request[] = [];
      const result = await runTaskAssignmentEmail(harness.env, async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(null, { status: 200 });
      });
      assert.deepEqual(result, { enabled: true, sent: 1, retried: 0, failed: 0 });
      assert.equal(requests.length, 1);
      const body = await requests[0]!.clone().json() as { to: string[] };
      assert.deepEqual(body.to, ["dale@hplacer.com"]);
    } finally {
      harness.close();
    }
  });
});
