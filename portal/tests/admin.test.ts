import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { can } from "../src/auth/authz.ts";
import { listDefects, reportDefect, resolveDefect } from "../src/domain/defects.ts";
import { listEmployees } from "../src/domain/employees.ts";
import { listParts } from "../src/domain/inventory.ts";
import { inbox } from "../src/domain/notifications.ts";
import { linkOverview, pendingSyncQueue } from "../src/integrations/monday.ts";
import { createHarness, form, jsonBody, type Harness } from "./harness.ts";

describe("staff administration", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("adds an employee with a second role and lets them sign in", async () => {
    const response = await harness.request("/api/employees", {
      ...form({
        email: "Rhonda@HPlacer.com",
        display_name: "Rhonda B.",
        role: "supervisor",
        extra_role: "billing",
        crew: "Office",
      }),
    });
    assert.equal(response.status, 303);

    const actor = await harness.actor("rhonda@hplacer.com");
    assert.equal(actor.email, "rhonda@hplacer.com");
    assert.deepEqual(actor.roles.sort(), ["billing", "supervisor"]);
    assert.ok(can(actor, "repair.bill"));
  });

  it("refuses a duplicate address and a malformed one", async () => {
    const duplicate = await harness.request("/api/employees", {
      ...jsonBody({ email: "rhonda@hplacer.com", display_name: "Again", role: "employee" }),
    });
    assert.equal(duplicate.status, 409);

    const malformed = await harness.request("/api/employees", {
      ...jsonBody({ email: "not-an-email", display_name: "X", role: "employee" }),
    });
    assert.equal(malformed.status, 400);
  });

  it("grants and revokes a role", async () => {
    const employees = await listEmployees(harness.db);
    const dale = employees.find((person) => person.email === "dale@hplacer.com")!;

    await harness.request(`/api/employees/${dale.id}/roles`, { ...form({ role: "supervisor" }) });
    assert.ok(can(await harness.actor("dale@hplacer.com"), "task.assign"));

    await harness.request(`/api/employees/${dale.id}/roles`, { ...form({ role: "supervisor", revoke: true }) });
    assert.ok(!can(await harness.actor("dale@hplacer.com"), "task.assign"));
  });

  it("stops an administrator locking themselves out", async () => {
    const ops = (await listEmployees(harness.db)).find((person) => person.email === "ops@hplacer.com")!;
    const response = await harness.request(`/api/employees/${ops.id}/active`, { ...jsonBody({ active: "0" }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /cannot deactivate your own account/);
  });

  it("blocks a deactivated employee at the next request", async () => {
    const employees = await listEmployees(harness.db);
    const nina = employees.find((person) => person.email === "nina@hplacer.com")!;
    await harness.request(`/api/employees/${nina.id}/active`, { ...form({ active: "0" }) });
    const response = await harness.request("/tasks", { as: "nina@hplacer.com" });
    assert.equal(response.status, 403);
  });
});

describe("defect resolution", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("records who closed a defect and why", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    const brandon = await harness.actor("brandon@hplacer.com");

    const id = await reportDefect(harness.db, dale, {
      summary: "Cracked mirror on PK-01",
      severity: "minor",
      assetId: "ast_pk1",
    });

    const notices = await inbox(harness.db, brandon.employeeId);
    assert.ok(notices.some((notice) => notice.category === "defect_reported" && notice.related_id === id));

    await resolveDefect(harness.db, brandon, id, "resolved", "Mirror replaced from stock.");
    const [defect] = await listDefects(harness.db, { assetId: "ast_pk1" });
    assert.equal(defect.status, "resolved");
    assert.match(defect.detail ?? "", /Resolved by Brandon: Mirror replaced from stock\./);
  });

  it("insists on a reason when a defect is dismissed", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    const brandon = await harness.actor("brandon@hplacer.com");
    const id = await reportDefect(harness.db, dale, { summary: "Rattle in the cab", severity: "minor", assetId: "ast_pk2" });
    await assert.rejects(resolveDefect(harness.db, brandon, id, "dismissed"), /Say why the defect is being dismissed/);
  });

  it("keeps field crew out of the resolve endpoint", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    const id = await reportDefect(harness.db, dale, { summary: "Loose step", severity: "minor", assetId: "ast_pk2" });
    const response = await harness.request(`/api/defects/${id}/resolve`, {
      as: "dale@hplacer.com",
      ...jsonBody({ status: "resolved" }),
    });
    assert.equal(response.status, 403);
  });
});

describe("admin screens over HTTP", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("records a Monday link from the admin form", async () => {
    const response = await harness.request("/api/monday/links", {
      ...form({ entity_type: "asset", entity_id: "ast_pk1", board_key: "equipment", monday_item_id: "2000000501" }),
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/admin/monday?ok=linked");

    const links = await linkOverview(harness.db);
    const link = links.find((row) => row.entity_id === "ast_pk1");
    assert.equal(link?.canonical_key, "1FT8W2BT4PEC55011");
    assert.equal(link?.label, "PK-01");

    const page = await (await harness.request("/admin/monday")).text();
    assert.match(page, /1FT8W2BT4PEC55011/);
    assert.match(page, /does not call Monday/);
  });

  it("detaches from the admin screen", async () => {
    const response = await harness.request("/api/monday/links/asset/ast_pk1/detach", { method: "POST" });
    assert.equal(response.status, 303);
    const links = await linkOverview(harness.db);
    assert.equal(links.find((row) => row.entity_id === "ast_pk1")?.sync_state, "detached");
    const queue = await pendingSyncQueue(harness.db);
    assert.ok(queue.some((row) => row.operation === "detach" && row.entity_id === "ast_pk1"));
  });

  it("runs the maintenance sweeps and reports what it did", async () => {
    const result = await harness.json<{ lowStock: number; serviceDue: number }>("/api/maintenance/sweeps", { method: "POST" });
    const low = await listParts(harness.db, { lowOnly: true });
    assert.equal(result.lowStock, low.length);
    assert.ok(result.serviceDue > 0);
  });

  it("keeps the sweeps and the audit log away from non-admins", async () => {
    assert.equal((await harness.request("/api/maintenance/sweeps", { as: "tara@hplacer.com", method: "POST" })).status, 403);
    assert.equal((await harness.request("/admin/audit", { as: "tara@hplacer.com" })).status, 403);
  });
});
