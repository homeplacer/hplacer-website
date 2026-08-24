import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { can } from "../src/auth/authz.ts";
import { homeWorkflow } from "../src/domain/home-workflow.ts";
import { getHome } from "../src/domain/homes.ts";
import { createHarness, form, jsonBody, type Harness } from "./harness.ts";

describe("per-home workflow checklist", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("starts with an unset delivery-date item and renders a native date picker", async () => {
    assert.deepEqual(await homeWorkflow(harness.db, "hom_a1"), [{
      item_key: "delivery_date",
      label: "Delivery date",
      value_date: null,
      updated_at: null,
      updated_by_name: null,
    }]);
    const page = await (await harness.request("/homes/hom_a1", { as: "dale@hplacer.com" })).text();
    assert.match(page, /<h2>Home checklist<\/h2>/);
    assert.match(page, /name="delivery_date" type="date"/);
  });

  it("lets a field user save and replace the planned delivery date", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    assert.ok(can(dale, "home.workflow.edit"));
    for (const date of ["2026-09-02", "2026-09-04"]) {
      const response = await harness.request("/api/homes/hom_a1/workflow/delivery-date", {
        as: "dale@hplacer.com",
        ...form({ delivery_date: date }),
      });
      assert.equal(response.status, 303);
    }
    const [item] = await homeWorkflow(harness.db, "hom_a1");
    assert.equal(item.value_date, "2026-09-04");
    assert.equal(item.updated_by_name, "Dale R.");
    assert.equal((await harness.db.prepare("SELECT count(*) AS n FROM home_workflow_items WHERE home_id = 'hom_a1'").first<{ n: number }>())?.n, 1);
  });

  it("keeps the planned date separate from the actual delivery report milestone", async () => {
    const actualBefore = (await getHome(harness.db, "hom_a1"))?.delivered_on;
    await harness.request("/api/homes/hom_a1/workflow/delivery-date", {
      as: "greg@hplacer.com",
      ...jsonBody({ delivery_date: "2026-09-10" }),
    });
    assert.equal((await getHome(harness.db, "hom_a1"))?.delivered_on, actualBefore);
  });

  it("rejects impossible dates and permits clearing a date", async () => {
    const invalid = await harness.request("/api/homes/hom_a1/workflow/delivery-date", {
      as: "dale@hplacer.com",
      ...jsonBody({ delivery_date: "2026-02-31" }),
    });
    assert.equal(invalid.status, 400);
    await harness.request("/api/homes/hom_a1/workflow/delivery-date", { as: "dale@hplacer.com", ...jsonBody({ delivery_date: "2026-09-10" }) });
    assert.equal((await harness.request("/api/homes/hom_a1/workflow/delivery-date", { as: "dale@hplacer.com", ...jsonBody({ delivery_date: "" }) })).status, 200);
    assert.equal((await homeWorkflow(harness.db, "hom_a1"))[0].value_date, null);
  });

  it("keeps edit permission explicit for every active portal role", async () => {
    for (const email of ["dale@hplacer.com", "greg@hplacer.com", "tara@hplacer.com", "ops@hplacer.com"]) {
      assert.ok(can(await harness.actor(email), "home.workflow.edit"), email);
    }
  });
});
