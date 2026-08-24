import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Actor } from "../src/auth/authz.ts";
import { listDefects } from "../src/domain/defects.ts";
import {
  addLabor,
  addMaterial,
  assertCanViewRepair,
  billingQueue,
  createRepair,
  getRepair,
  listRepairs,
  listStatusEvents,
  setRepairStatus,
  setResponsibleParty,
  updateBillBack,
} from "../src/domain/repairs.ts";
import { submitInspection, type AnswerInput } from "../src/domain/inspections.ts";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("repair tickets", () => {
  let harness: Harness;
  let wes: Actor;
  let brett: Actor;

  beforeEach(async () => {
    harness = await createHarness();
    wes = await harness.actor("wes@hplacer.com");
    brett = await harness.actor("brett@hplacer.com");
  });

  it("allocates dense, year-scoped ticket numbers", async () => {
    const now = new Date("2026-08-21T12:00:00Z");
    const first = await createRepair(harness.db, wes, { title: "A", description: "a", assetId: "ast_ex1" }, now);
    const second = await createRepair(harness.db, wes, { title: "B", description: "b", assetId: "ast_ex1" }, now);
    const a = await getRepair(harness.db, first);
    const b = await getRepair(harness.db, second);
    // The seed ships RT-2026-0001..0003.
    assert.equal(a?.ticket_number, "RT-2026-0004");
    assert.equal(b?.ticket_number, "RT-2026-0005");
  });

  it("requires exactly one subject", async () => {
    await assert.rejects(createRepair(harness.db, wes, { title: "A", description: "a" }), /name a home or a machine/);
    await assert.rejects(
      createRepair(harness.db, wes, { title: "A", description: "a", homeId: "hom_a1", assetId: "ast_ex1" }),
      /not both/,
    );
  });

  it("carries a defect through to the ticket and marks it ticketed", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    const answers: AnswerInput[] = [
      "walkaround",
      "engine_oil",
      "hydraulic_fluid",
      "coolant",
      "tracks",
      "bucket_teeth",
      "controls",
      "seatbelt",
      "fire_ext",
    ].map((checklistKey) => ({
      checklistKey,
      result: checklistKey === "bucket_teeth" ? ("fail" as const) : ("pass" as const),
      notes: checklistKey === "bucket_teeth" ? "Two teeth missing" : null,
    }));

    const inspection = await submitInspection(harness.db, dale, {
      templateKey: "daily_excavator",
      assetId: "ast_ex1",
      meterReading: 3200,
      answers,
    });
    const defectId = inspection.defectIds[0];

    const ticketId = await createRepair(harness.db, brett, {
      title: "Replace bucket teeth",
      description: "Two J350 teeth missing.",
      sourceDefectId: defectId,
      sourceInspectionId: inspection.inspectionId,
    });

    const ticket = await getRepair(harness.db, ticketId);
    assert.equal(ticket?.asset_id, "ast_ex1", "the subject is inherited from the defect");
    assert.equal(ticket?.source_inspection_id, inspection.inspectionId);

    const defects = await listDefects(harness.db, { assetId: "ast_ex1" });
    const linked = defects.find((defect) => defect.id === defectId);
    assert.equal(linked?.status, "ticketed");
    assert.equal(linked?.repair_ticket_id, ticketId);
  });

  it("enforces the status ladder", async () => {
    const id = await createRepair(harness.db, wes, { title: "A", description: "a", assetId: "ast_ex1" });
    await assert.rejects(setRepairStatus(harness.db, brett, id, "complete"), /cannot move straight to complete/);
    await setRepairStatus(harness.db, brett, id, "approved", "Go ahead");
    await setRepairStatus(harness.db, brett, id, "in_progress");
    await setRepairStatus(harness.db, brett, id, "complete");
    await assert.rejects(setRepairStatus(harness.db, brett, id, "billed"), /from the billing queue/);

    const events = await listStatusEvents(harness.db, id);
    assert.deepEqual(events.map((event) => event.to_value), ["complete", "in_progress", "approved"]);
    assert.equal(events.at(-1)?.note, "Go ahead");

    const ticket = await getRepair(harness.db, id);
    assert.equal(ticket?.approved_by, brett.employeeId);
    assert.ok(ticket?.completed_at);
  });

  it("totals labor and materials to the cent", async () => {
    const id = await createRepair(harness.db, wes, { title: "A", description: "a", assetId: "ast_ex1" });
    await addLabor(harness.db, wes, {
      repairId: id,
      employeeId: wes.employeeId,
      workedOn: "2026-08-21",
      minutes: 90,
      rateCentsPerHour: 8500,
    });
    await addMaterial(harness.db, wes, {
      repairId: id,
      partId: "prt_tooth",
      description: "Bucket tooth",
      quantity: 2,
      unitCostCents: 1980,
      consumeStock: true,
    });

    const ticket = await getRepair(harness.db, id);
    assert.equal(ticket?.labor_cents, 12750, "90 minutes at $85/h");
    assert.equal(ticket?.material_cents, 3960, "2 × $19.80");
    assert.equal(ticket?.total_cents, 16710);
    assert.equal(ticket?.labor_minutes, 90);

    const part = await harness.db.prepare("SELECT quantity_on_hand FROM parts WHERE id = 'prt_tooth'").first<{ quantity_on_hand: number }>();
    assert.equal(part?.quantity_on_hand, 34, "36 on hand less the 2 consumed");
  });

  it("rejects nonsense labor entries", async () => {
    const id = await createRepair(harness.db, wes, { title: "A", description: "a", assetId: "ast_ex1" });
    const base = { repairId: id, employeeId: wes.employeeId, workedOn: "2026-08-21", rateCentsPerHour: 8500 };
    await assert.rejects(addLabor(harness.db, wes, { ...base, minutes: 0 }), /Enter the minutes worked/);
    await assert.rejects(addLabor(harness.db, wes, { ...base, minutes: 5000 }), /more than a day/);
    await assert.rejects(addLabor(harness.db, wes, { ...base, minutes: 60, workedOn: "yesterday" }), /must look like/);
  });

  it("will not draw more stock than the shelf holds", async () => {
    const id = await createRepair(harness.db, wes, { title: "A", description: "a", assetId: "ast_ex1" });
    await assert.rejects(
      addMaterial(harness.db, wes, { repairId: id, partId: "prt_hyd", description: "hose", quantity: 99, unitCostCents: 6200, consumeStock: true }),
      /Only 3 each of HYD-3812 on hand/,
    );
  });

  it("scopes ticket visibility to the crew that owns it", async () => {
    const id = await createRepair(harness.db, wes, { title: "Private", description: "a", assetId: "ast_ex1" });
    const ticket = await getRepair(harness.db, id);
    const nina = await harness.actor("nina@hplacer.com");
    assert.throws(() => assertCanViewRepair(nina, ticket!), /belongs to another crew/);
    assert.doesNotThrow(() => assertCanViewRepair(wes, ticket!));
    assert.doesNotThrow(() => assertCanViewRepair(brett, ticket!));

    const ninaList = await listRepairs(harness.db, nina, {});
    assert.ok(!ninaList.some((row) => row.id === id));
  });
});

describe("bill-back queue", () => {
  let harness: Harness;
  let tara: Actor;
  let brandon: Actor;

  before(async () => {
    harness = await createHarness();
    tara = await harness.actor("tara@hplacer.com");
    brandon = await harness.actor("brandon@hplacer.com");
  });
  after(() => harness.close());

  it("puts a flagged ticket in front of billing", async () => {
    const queue = await billingQueue(harness.db);
    assert.ok(queue.some((ticket) => ticket.ticket_number === "RT-2026-0001"));
    assert.ok(!queue.some((ticket) => ticket.ticket_number === "RT-2026-0003"), "already billed");
  });

  it("refuses to bill before a responsible party is named", async () => {
    await harness.db.prepare("UPDATE repair_tickets SET responsible_party_type = NULL WHERE id = 'rep_1'").run();
    await assert.rejects(
      updateBillBack(harness.db, tara, { repairId: "rep_1", billBackStatus: "ready_to_bill" }),
      /Name the responsible party/,
    );
    await setResponsibleParty(harness.db, brandon, "rep_1", "transporter", "Ridgeline Transport");
  });

  it("walks the queue statuses in order and demands an amount and a reference", async () => {
    await assert.rejects(
      updateBillBack(harness.db, tara, { repairId: "rep_1", billBackStatus: "billed", amountCents: 40150, invoiceReference: "X" }),
      /cannot move from review needed to billed/,
    );
    await updateBillBack(harness.db, tara, { repairId: "rep_1", billBackStatus: "ready_to_bill" });
    await assert.rejects(updateBillBack(harness.db, tara, { repairId: "rep_1", billBackStatus: "billed" }), /Enter the amount/);
    await assert.rejects(
      updateBillBack(harness.db, tara, { repairId: "rep_1", billBackStatus: "billed", amountCents: 40150 }),
      /invoice reference/,
    );

    await updateBillBack(harness.db, tara, {
      repairId: "rep_1",
      billBackStatus: "billed",
      amountCents: 40150,
      invoiceReference: "RL-88213",
      notes: "Claim filed with the delivery photos.",
    });

    const ticket = await getRepair(harness.db, "rep_1");
    assert.equal(ticket?.bill_back_status, "billed");
    assert.equal(ticket?.status, "billed", "billing the work back closes out the repair status too");
    assert.equal(ticket?.bill_back_amount_cents, 40150);
    assert.equal(ticket?.billed_by, tara.employeeId);
    assert.ok(ticket?.billed_at);

    // The person who raised it hears about the outcome.
    const notices = await inbox(harness.db, ticket!.reported_by);
    assert.ok(notices.some((notice) => notice.title.includes("RT-2026-0001") && notice.title.includes("billed")));
  });

  it("refuses to bill an unfinished repair", async () => {
    await setResponsibleParty(harness.db, brandon, "rep_2", "manufacturer", "Case");
    await updateBillBack(harness.db, tara, { repairId: "rep_2", billBackStatus: "review_needed" });
    await updateBillBack(harness.db, tara, { repairId: "rep_2", billBackStatus: "ready_to_bill" });
    await assert.rejects(
      updateBillBack(harness.db, tara, { repairId: "rep_2", billBackStatus: "billed", amountCents: 10000, invoiceReference: "Z-1" }),
      /Finish the repair/,
    );
  });
});
