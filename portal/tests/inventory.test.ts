import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Actor } from "../src/auth/authz.ts";
import {
  advanceMaterialRequest,
  checkLowStock,
  createMaterialRequest,
  createPart,
  getPart,
  listMaterialRequests,
  listParts,
  recordMovement,
  sweepLowStock,
} from "../src/domain/inventory.ts";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("stock movements", () => {
  let harness: Harness;
  let tara: Actor;
  let wes: Actor;

  beforeEach(async () => {
    harness = await createHarness();
    tara = await harness.actor("tara@hplacer.com");
    wes = await harness.actor("wes@hplacer.com");
  });

  it("applies the sign convention regardless of what the caller passes", async () => {
    const before = await getPart(harness.db, "prt_skirt");
    await recordMovement(harness.db, { partId: "prt_skirt", movementType: "used", quantity: 12, recordedBy: wes.employeeId });
    const afterUse = await getPart(harness.db, "prt_skirt");
    assert.equal(afterUse?.quantity_on_hand, (before?.quantity_on_hand ?? 0) - 12, "'used' always subtracts");

    await recordMovement(harness.db, { partId: "prt_skirt", movementType: "received", quantity: -20, recordedBy: tara.employeeId });
    const afterReceive = await getPart(harness.db, "prt_skirt");
    assert.equal(afterReceive?.quantity_on_hand, (afterUse?.quantity_on_hand ?? 0) + 20, "'received' always adds");
  });

  it("lets an adjustment go either way", async () => {
    const before = await getPart(harness.db, "prt_skirt");
    await recordMovement(harness.db, { partId: "prt_skirt", movementType: "adjustment", quantity: -3, recordedBy: tara.employeeId, notes: "Count correction" });
    const after = await getPart(harness.db, "prt_skirt");
    assert.equal(after?.quantity_on_hand, (before?.quantity_on_hand ?? 0) - 3);
  });

  it("refuses to take stock below zero", async () => {
    await assert.rejects(
      recordMovement(harness.db, { partId: "prt_hyd", movementType: "used", quantity: 500, recordedBy: wes.employeeId }),
      /Only 3 each of HYD-3812 on hand/,
    );
  });

  it("refuses a zero movement", async () => {
    await assert.rejects(
      recordMovement(harness.db, { partId: "prt_hyd", movementType: "adjustment", quantity: 0, recordedBy: wes.employeeId }),
      /non-zero quantity/,
    );
  });

  it("records an opening balance as a movement, not a bare number", async () => {
    const id = await createPart(harness.db, {
      sku: "tst-0001",
      name: "Test widget",
      reorderPoint: 2,
      reorderQuantity: 10,
      preferredVendor: "Southern Supply",
      productUrl: "https://www.example-vendor.com/catalog/widget",
      preferredUnitCostCents: 999,
      openingQuantity: 5,
      recordedBy: tara.employeeId,
    });
    const part = await getPart(harness.db, id);
    assert.equal(part?.sku, "TST-0001");
    assert.equal(part?.quantity_on_hand, 5);
    const movements = await harness.db.prepare("SELECT count(*) AS n FROM inventory_movements WHERE part_id = ?").bind(id).first<{ n: number }>();
    assert.equal(movements?.n, 1);
  });

  it("refuses a vendor link that is not a web URL", async () => {
    await assert.rejects(
      createPart(harness.db, { sku: "TST-0002", name: "Bad link", productUrl: "javascript:alert(1)" }),
      /must start with http/,
    );
  });
});

describe("low-stock alerts", () => {
  let harness: Harness;
  let tara: Actor;

  before(async () => {
    harness = await createHarness();
    tara = await harness.actor("tara@hplacer.com");
  });
  after(() => harness.close());

  it("alerts billing once when a part crosses its reorder point", async () => {
    const first = await checkLowStock(harness.db, "prt_hyd");
    assert.equal(first, true);
    const second = await checkLowStock(harness.db, "prt_hyd");
    assert.equal(second, false, "the same shortage does not alert twice");

    const notices = await inbox(harness.db, tara.employeeId);
    const alert = notices.find((notice) => notice.category === "inventory_low" && notice.title.includes("HYD-3812"));
    assert.ok(alert);
    assert.match(alert!.body, /Preferred vendor: Carolina Hydraulics/);
    assert.match(alert!.body, /Suggested order: 10 each/);
  });

  it("re-arms once the shelf is restocked", async () => {
    await recordMovement(harness.db, { partId: "prt_hyd", movementType: "received", quantity: 20, recordedBy: tara.employeeId });
    const part = await getPart(harness.db, "prt_hyd");
    assert.equal(part?.low_stock_notified_at, null, "the marker is cleared when stock recovers");

    await recordMovement(harness.db, { partId: "prt_hyd", movementType: "used", quantity: 21, recordedBy: tara.employeeId });
    const refreshed = await getPart(harness.db, "prt_hyd");
    assert.ok(refreshed!.quantity_on_hand <= refreshed!.reorder_point);
    assert.ok(refreshed?.low_stock_notified_at, "crossing the line again alerts again");
  });

  it("sweeps every part that is already low", async () => {
    await harness.db.prepare("UPDATE parts SET low_stock_notified_at = NULL").run();
    await harness.db.prepare("DELETE FROM notifications WHERE category = 'inventory_low'").run();
    const alerted = await sweepLowStock(harness.db);
    const low = await listParts(harness.db, { lowOnly: true });
    assert.equal(alerted, low.length);
    assert.ok(alerted >= 2, "the seed leaves several fast movers under their reorder point");
  });
});

describe("material requests", () => {
  let harness: Harness;
  let wes: Actor;
  let tara: Actor;

  before(async () => {
    harness = await createHarness();
    wes = await harness.actor("wes@hplacer.com");
    tara = await harness.actor("tara@hplacer.com");
  });
  after(() => harness.close());

  it("raises a request off a repair ticket and fills in the vendor from the part", async () => {
    const id = await createMaterialRequest(harness.db, wes, {
      partId: "prt_hyd",
      repairTicketId: "rep_2",
      quantity: 4,
      description: "Hydraulic hose for SS-02",
      neededBy: "2026-08-25",
    });
    const request = (await listMaterialRequests(harness.db, {})).find((row) => row.id === id);
    assert.equal(request?.status, "requested");
    assert.equal(request?.supplier_name, "Carolina Hydraulics");
    assert.equal(request?.supplier_url, "https://www.example-vendor.com/catalog/hose-3812");
    assert.equal(request?.ticket_number, "RT-2026-0002");

    const notices = await inbox(harness.db, tara.employeeId);
    assert.ok(notices.some((notice) => notice.category === "material_requested" && notice.related_id === id));
  });

  it("walks the request through approval and puts the delivery on the shelf", async () => {
    const requests = await listMaterialRequests(harness.db, { status: "requested" });
    const request = requests[0];
    const before = await getPart(harness.db, "prt_hyd");

    await assert.rejects(
      advanceMaterialRequest(harness.db, tara, { requestId: request.id, status: "received" }),
      /A requested request cannot move to received/,
    );

    await advanceMaterialRequest(harness.db, tara, { requestId: request.id, status: "approved" });
    await advanceMaterialRequest(harness.db, tara, { requestId: request.id, status: "ordered" });
    await advanceMaterialRequest(harness.db, tara, { requestId: request.id, status: "received", receivedQuantity: 3 });

    const after = await getPart(harness.db, "prt_hyd");
    assert.equal(after?.quantity_on_hand, (before?.quantity_on_hand ?? 0) + 3, "the short shipment is what lands on the shelf");

    const notices = await inbox(harness.db, wes.employeeId);
    assert.ok(notices.some((notice) => notice.title === "Your request is received"));
  });

  it("insists the request is attached to something", async () => {
    await assert.rejects(
      createMaterialRequest(harness.db, wes, { quantity: 1, description: "Something" }),
      /Link the request to a part, a repair ticket, or an inspection/,
    );
  });
});
