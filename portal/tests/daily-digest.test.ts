import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { dailyDigestSummary, formatDailyDigest, sendDailyDigest } from "../src/domain/daily-digest.ts";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("daily operations digest", () => {
  let harness: Harness;

  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("summarizes live operational queues and creates one routed inbox item per day", async () => {
    const tara = await harness.actor("tara@hplacer.com");
    const now = new Date("2026-08-23T11:00:00Z");
    const summary = await dailyDigestSummary(harness.db, now);
    assert.ok(summary.openRepairs > 0, "seed has active repair work");
    assert.ok(summary.lowStockParts > 0, "seed has parts below reorder points");

    const first = await sendDailyDigest(harness.db, now);
    assert.ok(first > 0);
    const notices = await inbox(harness.db, tara.employeeId);
    const digest = notices.find((notice) => notice.category === "daily_digest");
    assert.ok(digest);
    assert.equal(digest!.title, "Daily operations digest — 2026-08-23");
    assert.match(digest!.body, /open repair/);

    const repeated = await sendDailyDigest(harness.db, new Date("2026-08-23T18:00:00Z"));
    assert.equal(repeated, 0, "retries on the same day do not duplicate the digest");
    assert.ok((await sendDailyDigest(harness.db, new Date("2026-08-24T11:00:00Z"))) > 0, "a new UTC day creates a new digest");
  });

  it("produces a useful all-clear message for an empty operational queue", () => {
    assert.equal(
      formatDailyDigest({ openRepairs: 0, readyToBill: 0, openMaterialRequests: 0, lowStockParts: 0, openDefects: 0, unreviewedWarrantyRequests: 0, serviceDue: 0 }),
      "Today: no open repair, inventory, service, defect, billing, or warranty items need attention.",
    );
  });
});
