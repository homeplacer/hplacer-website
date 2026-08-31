import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertCan, can, isOwnerOr, type Actor, type Permission } from "../src/auth/authz.ts";
import { loadActor } from "../src/auth/session.ts";
import { createHarness, identityFor, type Harness } from "./harness.ts";

describe("role permissions", () => {
  let harness: Harness;
  let employee: Actor;
  let supervisor: Actor;
  let billing: Actor;
  let admin: Actor;

  before(async () => {
    harness = await createHarness();
    employee = await harness.actor("dale@hplacer.com");
    supervisor = await harness.actor("greg@hplacer.com");
    billing = await harness.actor("tara@hplacer.com");
    admin = await harness.actor("ops@hplacer.com");
  });
  after(() => harness.close());

  it("gives field crew the field workflows and nothing else", () => {
    const allowed: Permission[] = ["inspection.submit", "defect.report", "repair.create", "material_request.create", "document.upload"];
    for (const permission of allowed) assert.ok(can(employee, permission), `employee should have ${permission}`);

    const denied: Permission[] = ["task.assign", "repair.approve", "repair.bill", "asset.write", "employee.manage", "task.read.all", "repair.read.all"];
    for (const permission of denied) assert.ok(!can(employee, permission), `employee should NOT have ${permission}`);
  });

  it("lets supervisors run field work but not the billing queue", () => {
    for (const permission of ["task.assign", "repair.approve", "asset.write", "home.report.submit", "defect.resolve"] as Permission[]) {
      assert.ok(can(supervisor, permission), `supervisor should have ${permission}`);
    }
    assert.ok(!can(supervisor, "repair.bill"));
    assert.ok(!can(supervisor, "employee.manage"));
    assert.ok(!can(supervisor, "monday.manage"));
  });

  it("gives Tara both hats — supervisor plus billing", () => {
    assert.deepEqual(billing.roles.sort(), ["billing", "supervisor"]);
    assert.ok(can(billing, "repair.bill"));
    assert.ok(can(billing, "inventory.manage"));
    assert.ok(can(billing, "task.assign"));
    assert.ok(!can(billing, "employee.manage"));
  });

  it("keeps a billing-only role away from field work", async () => {
    const billingOnly: Actor = { ...billing, roles: ["billing"], primaryRole: "billing" };
    assert.ok(can(billingOnly, "repair.bill"));
    assert.ok(!can(billingOnly, "task.assign"));
    assert.ok(!can(billingOnly, "asset.write"));
    assert.ok(!can(billingOnly, "inspection.submit"));
  });

  it("gives admin everything", () => {
    for (const permission of ["employee.manage", "monday.manage", "audit.read", "repair.bill", "task.assign"] as Permission[]) {
      assert.ok(can(admin, permission), `admin should have ${permission}`);
    }
  });

  it("explains a refusal in terms of the caller's roles", () => {
    assert.throws(() => assertCan(employee, "repair.bill"), /Your role \(employee\) cannot repair bill/);
  });

  it("falls back to record ownership when the permission is missing", () => {
    assert.ok(isOwnerOr(employee, "repair.read.all", employee.employeeId));
    assert.ok(!isOwnerOr(employee, "repair.read.all", "emp_someone_else"));
    assert.ok(isOwnerOr(supervisor, "repair.read.all", "emp_someone_else"));
  });
});

describe("session loading", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("refuses an identity with no employee record", async () => {
    await assert.rejects(loadActor(harness.db, identityFor("stranger@example.com")), /is not set up in the portal/);
  });

  it("refuses a deactivated employee", async () => {
    await harness.db.prepare("UPDATE employees SET active = 0 WHERE email = 'wes@hplacer.com'").run();
    await assert.rejects(loadActor(harness.db, identityFor("wes@hplacer.com")), /deactivated/);
    await harness.db.prepare("UPDATE employees SET active = 1 WHERE email = 'wes@hplacer.com'").run();
  });

  it("binds the Access subject on first sign-in and reuses it afterwards", async () => {
    const before = await harness.db
      .prepare("SELECT access_subject FROM employees WHERE email = 'nina@hplacer.com'")
      .first<{ access_subject: string }>();
    assert.equal(before?.access_subject, "pending:nina@hplacer.com");

    const actor = await loadActor(harness.db, identityFor("nina@hplacer.com"));
    const after = await harness.db
      .prepare("SELECT access_subject, last_seen_at FROM employees WHERE id = ?")
      .bind(actor.employeeId)
      .first<{ access_subject: string; last_seen_at: string }>();
    assert.equal(after?.access_subject, "dev|nina@hplacer.com");
    assert.ok(after?.last_seen_at);

    // A second sign-in finds the row by subject, not by email.
    const again = await loadActor(harness.db, { subject: "dev|nina@hplacer.com", email: "changed@hplacer.com", method: "local_development" });
    assert.equal(again.employeeId, actor.employeeId);
  });
});
