import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notify } from "../src/domain/notifications.ts";
import {
  dispatchNotificationOutbox,
  NotificationDeliveryError,
  type NotificationDeliveryMessage,
} from "../src/domain/notification-delivery.ts";
import { createHarness } from "./harness.ts";

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
});
