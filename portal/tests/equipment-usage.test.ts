import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHarness, form, type Harness } from "./harness.ts";

describe("shared equipment use log", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("lets field employees record shared use at a job and updates the meter history", async () => {
    const response = await harness.request("/api/equipment/EX-01/usage", {
      as: "dale@hplacer.com",
      ...form({ job_id: "job_2601", hour_meter: 3185.2, notes: "Checked the bucket teeth" }),
    });
    assert.equal(response.status, 303);

    const use = await harness.db.prepare("SELECT * FROM asset_usage_records WHERE asset_id = 'ast_ex1'").first<{
      employee_id: string; job_id: string; hour_meter: number; odometer: number | null; notes: string;
    }>();
    assert.deepEqual(use && { employee_id: use.employee_id, job_id: use.job_id, hour_meter: use.hour_meter, odometer: use.odometer, notes: use.notes }, {
      employee_id: "emp_dale", job_id: "job_2601", hour_meter: 3185.2, odometer: null, notes: "Checked the bucket teeth",
    });

    const asset = await harness.db.prepare("SELECT hour_meter FROM assets WHERE id = 'ast_ex1'").first<{ hour_meter: number }>();
    assert.equal(asset?.hour_meter, 3185.2);
    const detail = await (await harness.request("/equipment/EX-01", { as: "dale@hplacer.com" })).text();
    assert.match(detail, /Shared use/);
    assert.match(detail, /Checked the bucket teeth/);
    assert.match(detail, /Mill Creek Ridge/);
  });

  it("rejects a meter reading below the last recorded value", async () => {
    const response = await harness.request("/api/equipment/EX-01/usage", {
      as: "dale@hplacer.com",
      ...form({ hour_meter: 3100 }),
    });
    assert.equal(response.status, 400);
    assert.equal(await harness.db.prepare("SELECT id FROM asset_usage_records").first(), null);
  });

  it("keeps use logging available to field staff but rejects billing-only staff", async () => {
    await harness.db.prepare(`INSERT INTO employees (id, access_subject, email, display_name, role)
      VALUES ('emp_billing_only', 'dev|billing-only@hplacer.com', 'billing-only@hplacer.com', 'Billing Only', 'billing')`).run();
    const employee = await harness.request("/api/equipment/EX-01/usage", {
      as: "dale@hplacer.com",
      ...form({ notes: "Shared use" }),
    });
    assert.equal(employee.status, 303);

    const billing = await harness.request("/api/equipment/EX-01/usage", {
      as: "billing-only@hplacer.com",
      ...form({ notes: "Should not be allowed" }),
    });
    assert.equal(billing.status, 403);
  });
});
