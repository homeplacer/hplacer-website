import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { can } from "../src/auth/authz.ts";
import { HOME_WORKFLOW_ITEMS, homeWorkflow } from "../src/domain/home-workflow.ts";
import { getHome } from "../src/domain/homes.ts";
import { createHarness, form, jsonBody, type Harness } from "./harness.ts";

describe("ordered per-home workflow", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("renders the complete checklist in order with shared documents first", async () => {
    const expected = [
      "Estimated delivery date", "Delivered", "Scheduled install date", "Install complete",
      "House numbers installed", "Permit received", "Meter set", "Inspection scheduled",
      "Inspection date", "Final inspection passed", "Electric ordered", "Sewer or septic",
      "Foundation certificate received", "Home inspection", "Skirting framing complete",
      "Skirting on", "Trim-out complete", "HVAC scheduled", "HVAC installed",
      "Sod / rock installed", "Driveway installed", "Mailbox set",
    ];
    assert.deepEqual(HOME_WORKFLOW_ITEMS.map((item) => item.label), expected);
    const page = await (await harness.request("/homes/hom_a1", { as: "dale@hplacer.com" })).text();
    assert.ok(page.indexOf("Site map") < page.indexOf("Estimated delivery date"));
    assert.ok(page.indexOf("Plat") < page.indexOf("Estimated delivery date"));
    assert.match(page, /name="value" type="date"/);
    assert.match(page, /Estimate only; the delivery report records actual completion/);
  });

  it("saves dates, yes/no states, and the utility choice with visible history", async () => {
    const changes = [
      ["delivery_date", "2026-09-02"], ["scheduled_install_date", "2026-09-08"],
      ["house_numbers_installed", "yes"], ["permit_received", "yes"],
      ["inspection_scheduled", "yes"], ["inspection_date", "2026-09-12"],
      ["final_inspection_passed", "yes"], ["electric_ordered", "no"], ["utility_type", "septic"],
    ];
    for (const [key, value] of changes) {
      assert.equal((await harness.request(`/api/homes/hom_a1/workflow/${key}`, { as: "dale@hplacer.com", ...jsonBody({ value }) })).status, 200);
    }
    await harness.request("/api/homes/hom_a1/workflow/house_numbers_installed", { as: "greg@hplacer.com", ...jsonBody({ value: "no" }) });
    const workflow = await homeWorkflow(harness.db, "hom_a1");
    const numbers = workflow.find((item) => item.item_key === "house_numbers_installed")!;
    assert.equal(numbers.value_boolean, 0);
    assert.equal(numbers.history.length, 2);
    assert.equal(numbers.history[0].changed_by_name, "Greg");
    assert.deepEqual([numbers.history[0].old_value, numbers.history[0].new_value], ["yes", "no"]);
    const page = await (await harness.request("/homes/hom_a1", { as: "dale@hplacer.com" })).text();
    assert.match(page, /History \(2\)/);
    assert.match(page, /Upload Building permit/);
    assert.match(page, /Upload Final inspection report/);
    assert.match(page, /Upload Septic permit/);
  });

  it("shows conditional controls only after their prerequisite is saved", async () => {
    let page = await (await harness.request("/homes/hom_a2", { as: "dale@hplacer.com" })).text();
    assert.ok(!page.includes("Inspection date</h3>"));
    assert.ok(!page.includes("Electric ordered</h3>"));
    await harness.request("/api/homes/hom_a2/workflow/inspection_scheduled", { as: "dale@hplacer.com", ...jsonBody({ value: "yes" }) });
    await harness.request("/api/homes/hom_a2/workflow/final_inspection_passed", { as: "dale@hplacer.com", ...jsonBody({ value: "yes" }) });
    page = await (await harness.request("/homes/hom_a2", { as: "dale@hplacer.com" })).text();
    assert.match(page, /Inspection date<\/h3>/);
    assert.match(page, /Electric ordered<\/h3>/);
  });

  it("preserves report-derived actual states and actual milestone fields", async () => {
    const actualBefore = (await getHome(harness.db, "hom_a1"))?.delivered_on;
    const workflow = await homeWorkflow(harness.db, "hom_a1");
    assert.equal(workflow.find((item) => item.item_key === "delivered")?.value_boolean, actualBefore ? 1 : 0);
    await harness.request("/api/homes/hom_a1/workflow/delivered", { as: "greg@hplacer.com", ...jsonBody({ value: "no" }) });
    assert.equal((await getHome(harness.db, "hom_a1"))?.delivered_on, actualBefore);
  });

  it("rejects invalid values and keeps workflow edit permission explicit", async () => {
    assert.equal((await harness.request("/api/homes/hom_a1/workflow/inspection_date", { as: "dale@hplacer.com", ...jsonBody({ value: "2026-02-31" }) })).status, 400);
    assert.equal((await harness.request("/api/homes/hom_a1/workflow/meter_set", { as: "dale@hplacer.com", ...jsonBody({ value: "maybe" }) })).status, 400);
    assert.equal((await harness.request("/api/homes/hom_a1/workflow/utility_type", { as: "dale@hplacer.com", ...jsonBody({ value: "well" }) })).status, 400);
    for (const email of ["dale@hplacer.com", "greg@hplacer.com", "tara@hplacer.com", "ops@hplacer.com"]) {
      assert.ok(can(await harness.actor(email), "home.workflow.edit"), email);
    }
  });

  it("allows authenticated uploads for Site map and Plat and requires confirmed deletion", async () => {
    const body = new FormData();
    body.set("home_id", "hom_a1");
    body.set("redirect_to", "/homes/hom_a1");
    body.set("home_document_category", "site_map");
    body.set("file", new File([new Uint8Array([1, 2, 3])], "site-map.pdf", { type: "application/pdf" }));
    assert.equal((await harness.request("/api/documents/upload", { as: "dale@hplacer.com", method: "POST", body })).status, 303);
    const document = await harness.db.prepare("SELECT id, caption FROM documents WHERE caption = 'Site map'").first<{ id: string; caption: string }>();
    assert.ok(document);
    assert.equal((await harness.request(`/api/documents/${document!.id}/delete`, { as: "dale@hplacer.com", ...form({ redirect_to: "/homes/hom_a1" }) })).status, 400);
    assert.equal((await harness.request(`/api/documents/${document!.id}/delete`, { as: "dale@hplacer.com", ...form({ redirect_to: "/homes/hom_a1", confirm_delete: "yes" }) })).status, 303);
  });
});
