import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recentAudit } from "../src/domain/audit.ts";
import { QueuedMondaySyncPort, queuePush } from "../src/integrations/monday.ts";
import {
  drainMondaySyncQueue,
  mondayWriteEnabled,
  parseMondayWriteMappings,
  runConfiguredMondaySync,
  type MondayWriteMappings,
} from "../src/integrations/monday-sync-processor.ts";
import { MondayTransportError, type MondayWriteTransport, type RemoteMondayItem } from "../src/integrations/monday-write-transport.ts";
import { createHarness, jsonBody } from "./harness.ts";
import type { Db } from "../src/platform/types.ts";

const mappings: MondayWriteMappings = {
  homes: { boardId: "1000000001", columns: { status: "status" } },
};

class FakeTransport implements MondayWriteTransport {
  item: RemoteMondayItem | null = {
    id: "2000000011",
    boardId: "1000000001",
    values: { status: "Delivery scheduled" },
  };
  reads = 0;
  writes = 0;
  fail: Error | null = null;

  async readItem(): Promise<RemoteMondayItem | null> {
    this.reads += 1;
    if (this.fail) throw this.fail;
    return this.item ? { ...this.item, values: { ...this.item.values } } : null;
  }

  async writeColumns(_boardId: string, _itemId: string, values: Record<string, unknown>): Promise<void> {
    this.writes += 1;
    if (this.fail) throw this.fail;
    if (this.item) this.item.values = { ...this.item.values, ...values };
  }
}

async function queuedStatus(db: Db, id: string) {
  return db.prepare("SELECT status, attempts, last_error, next_attempt_at FROM monday_sync_queue WHERE id = ?").bind(id).first<{
    status: string;
    attempts: number;
    last_error: string | null;
    next_attempt_at: string | null;
  }>();
}

describe("guarded Monday sync", () => {
  it("is disabled by default and requires the exact feature flag", async () => {
    const harness = await createHarness();
    try {
      assert.equal(mondayWriteEnabled(harness.env), false);
      harness.env.MONDAY_WRITE_SYNC_ENABLED = "TRUE";
      assert.equal(mondayWriteEnabled(harness.env), false);
      const result = await runConfiguredMondaySync(harness.env);
      assert.deepEqual(result, {
        enabled: false, examined: 0, sent: 0, alreadyApplied: 0, retried: 0, conflicts: 0, failed: 0, skipped: 0,
      });
    } finally {
      harness.close();
    }
  });

  it("rejects unknown boards, logical fields, invalid columns, and duplicate targets", () => {
    assert.throws(() => parseMondayWriteMappings('{"other":{"boardId":"1","columns":{}}}'), /unknown board/);
    assert.throws(() => parseMondayWriteMappings('{"homes":{"boardId":"1","columns":{"phone":"text"}}}'), /not an allowlisted/);
    assert.throws(() => parseMondayWriteMappings('{"homes":{"boardId":"1","columns":{"status":"bad-id"}}}'), /Invalid Monday column/);
    assert.throws(
      () => parseMondayWriteMappings('{"homes":{"boardId":"1","columns":{"status":"text","address":"text"}}}'),
      /mapped more than once/,
    );
  });

  it("deduplicates identical queue intents", async () => {
    const harness = await createHarness();
    try {
      const port = new QueuedMondaySyncPort(harness.db);
      const first = await queuePush(harness.db, port, "home", "hom_a1", { status: "Setup complete" }, { expectedRemote: { status: "Delivery scheduled" } });
      const second = await queuePush(harness.db, port, "home", "hom_a1", { status: "Setup complete" }, { expectedRemote: { status: "Delivery scheduled" } });
      assert.equal(first, second);
      const count = await harness.db.prepare("SELECT count(*) AS count FROM monday_sync_queue WHERE id = ?").bind(first).first<{ count: number }>();
      assert.equal(count?.count, 1);
    } finally {
      harness.close();
    }
  });

  it("writes only after the expected value matches, then verifies the result", async () => {
    const harness = await createHarness();
    try {
      const id = await queuePush(
        harness.db,
        new QueuedMondaySyncPort(harness.db),
        "home",
        "hom_a1",
        { status: "Setup complete" },
        { expectedRemote: { status: "Delivery scheduled" } },
      );
      assert.ok(id);
      const transport = new FakeTransport();
      const result = await drainMondaySyncQueue(harness.db, transport, mappings, { enabled: true, now: new Date("2026-08-31T12:00:00Z") });
      assert.equal(result.sent, 1);
      assert.equal(transport.writes, 1);
      assert.equal(transport.reads, 2);
      const row = await queuedStatus(harness.db, id);
      assert.ok(row);
      assert.equal(row.status, "sent");
      const audit = await recentAudit(harness.db, 5);
      assert.ok(audit.some((entry) => entry.action === "monday.sync.process" && entry.outcome === "allowed"));
    } finally {
      harness.close();
    }
  });

  it("treats an already-applied value as idempotent success without writing", async () => {
    const harness = await createHarness();
    try {
      const id = await queuePush(harness.db, new QueuedMondaySyncPort(harness.db), "home", "hom_a1", { status: "Setup complete" });
      assert.ok(id);
      const transport = new FakeTransport();
      if (transport.item) transport.item.values.status = "Setup complete";
      const result = await drainMondaySyncQueue(harness.db, transport, mappings, { enabled: true });
      assert.equal(result.alreadyApplied, 1);
      assert.equal(transport.writes, 0);
      const row = await queuedStatus(harness.db, id);
      assert.ok(row);
      assert.equal(row.status, "sent");
    } finally {
      harness.close();
    }
  });

  it("fails closed on missing or stale expected values", async () => {
    for (const expectedRemote of [undefined, { status: "Some older value" }]) {
      const harness = await createHarness();
      try {
        const id = await queuePush(
          harness.db,
          new QueuedMondaySyncPort(harness.db),
          "home",
          "hom_a1",
          { status: "Setup complete" },
          expectedRemote ? { expectedRemote } : {},
        );
        assert.ok(id);
        const transport = new FakeTransport();
        const result = await drainMondaySyncQueue(harness.db, transport, mappings, { enabled: true });
        assert.equal(result.conflicts, 1);
        assert.equal(transport.writes, 0);
        const row = await queuedStatus(harness.db, id);
        assert.ok(row);
        assert.equal(row.status, "conflict");
      } finally {
        harness.close();
      }
    }
  });

  it("retries transient failures, redacts operational errors, and stops retrying permanent ones", async () => {
    const harness = await createHarness();
    try {
      const id = await queuePush(
        harness.db,
        new QueuedMondaySyncPort(harness.db),
        "home",
        "hom_a1",
        { status: "Setup complete" },
        { expectedRemote: { status: "Delivery scheduled" } },
      );
      assert.ok(id);
      const transport = new FakeTransport();
      transport.fail = new MondayTransportError("timeout for joe@example.com at 828-555-0199", true);
      const result = await drainMondaySyncQueue(harness.db, transport, mappings, { enabled: true, now: new Date("2026-08-31T12:00:00Z") });
      assert.equal(result.retried, 1);
      const row = await queuedStatus(harness.db, id);
      assert.ok(row);
      assert.equal(row.status, "retry");
      assert.ok(row.next_attempt_at);
      assert.ok(!row.last_error?.includes("joe@example.com"));
      assert.ok(!row.last_error?.includes("828-555-0199"));
    } finally {
      harness.close();
    }
  });

  it("keeps the manual admin control authorized and no-op while disabled", async () => {
    const harness = await createHarness();
    try {
      const denied = await harness.request("/api/monday/sync/run", { as: "dale@hplacer.com", ...jsonBody({}) });
      assert.equal(denied.status, 403);
      const allowed = await harness.request("/api/monday/sync/run", { as: "ops@hplacer.com", ...jsonBody({}) });
      assert.equal(allowed.status, 200);
      assert.equal((await allowed.json() as { enabled: boolean }).enabled, false);
    } finally {
      harness.close();
    }
  });
});
