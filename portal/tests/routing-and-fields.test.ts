import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { can } from "../src/auth/authz.ts";
import { formatSiteAddress, getHome, listHomes, updateSiteAddress } from "../src/domain/homes.ts";
import { getJob, listJobs } from "../src/domain/jobs.ts";
import { matchHome } from "../src/domain/matching.ts";
import {
  addRoute,
  inbox,
  listRouting,
  notifyCategory,
  recipientsFor,
  removeRoute,
} from "../src/domain/notifications.ts";
import { createHarness, form, jsonBody, type Harness } from "./harness.ts";

describe("notification routing", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });

  it("falls back to a category's default role when nothing is configured", async () => {
    // The seed configures only warranty_request, so this one is on its default.
    const recipients = await recipientsFor(harness.db, "inspection_failed");
    const supervisors = await harness.db
      .prepare("SELECT count(*) AS n FROM employees WHERE active = 1 AND role = 'supervisor'")
      .first<{ n: number }>();
    assert.equal(recipients.length, supervisors?.n);

    const routing = await listRouting(harness.db);
    assert.equal(routing.find((row) => row.category === "inspection_failed")?.using_default, true);
    assert.equal(routing.find((row) => row.category === "warranty_request")?.using_default, false);
  });

  it("lets an override replace the default entirely", async () => {
    const brett = await harness.actor("brett@hplacer.com");
    await addRoute(harness.db, {
      category: "inspection_failed",
      recipientKind: "employee",
      recipientEmployeeId: brett.employeeId,
    });

    const recipients = await recipientsFor(harness.db, "inspection_failed");
    assert.deepEqual(recipients, [brett.employeeId], "the default no longer applies once a route exists");

    await notifyCategory(harness.db, { category: "inspection_failed", title: "t", body: "b" });
    assert.equal((await inbox(harness.db, brett.employeeId)).length, 1);
    const greg = await harness.actor("greg@hplacer.com");
    assert.equal((await inbox(harness.db, greg.employeeId)).length, 0);
  });

  it("fans a role out to everyone holding it, grants included", async () => {
    const recipients = await recipientsFor(harness.db, "warranty_request");
    const tara = await harness.actor("tara@hplacer.com");
    assert.ok(recipients.includes(tara.employeeId), "Tara holds billing by grant, not by primary role");
    assert.ok(recipients.length > 1);
  });

  it("skips deactivated staff", async () => {
    const brett = await harness.actor("brett@hplacer.com");
    await harness.db.prepare("UPDATE employees SET active = 0 WHERE id = ?").bind(brett.employeeId).run();
    const recipients = await recipientsFor(harness.db, "inspection_failed");
    assert.ok(!recipients.includes(brett.employeeId));
  });

  it("reactivates a removed recipient instead of duplicating it", async () => {
    const id = await addRoute(harness.db, { category: "service_due", recipientKind: "role", recipientRole: "admin" });
    await harness.db.prepare("UPDATE notification_routes SET active = 0 WHERE id = ?").bind(id).run();
    await addRoute(harness.db, { category: "service_due", recipientKind: "role", recipientRole: "admin" });

    const rows = await harness.db
      .prepare("SELECT count(*) AS n FROM notification_routes WHERE category = 'service_due' AND recipient_role = 'admin'")
      .first<{ n: number }>();
    assert.equal(rows?.n, 1);
    const recipients = await recipientsFor(harness.db, "service_due");
    assert.ok(recipients.length > 0);
  });

  it("refuses an unknown category and an empty recipient", async () => {
    await assert.rejects(addRoute(harness.db, { category: "nope", recipientKind: "role", recipientRole: "admin" }), /No notification category/);
    await assert.rejects(addRoute(harness.db, { category: "service_due", recipientKind: "employee" }), /Choose a person/);
  });

  it("is administered over HTTP by admins only", async () => {
    assert.equal((await harness.request("/admin/notifications", { as: "ops@hplacer.com" })).status, 200);
    assert.equal((await harness.request("/admin/notifications", { as: "tara@hplacer.com" })).status, 403);

    const added = await harness.request("/api/notification-routes", {
      ...form({ category: "service_due", recipient_role: "billing" }),
    });
    assert.equal(added.status, 303);
    assert.ok((await recipientsFor(harness.db, "service_due")).length > 0);

    const denied = await harness.request("/api/notification-routes", {
      as: "greg@hplacer.com",
      ...jsonBody({ category: "service_due", recipient_role: "billing" }),
    });
    assert.equal(denied.status, 403);
  });

  it("refuses a route that names both a role and a person", async () => {
    const brett = await harness.actor("brett@hplacer.com");
    const response = await harness.request("/api/notification-routes", {
      ...jsonBody({ category: "service_due", recipient_role: "billing", recipient_employee_id: brett.employeeId }),
    });
    assert.equal(response.status, 400);
  });

  it("removes a route again", async () => {
    const brett = await harness.actor("brett@hplacer.com");
    const id = await addRoute(harness.db, {
      category: "task_assigned",
      recipientKind: "employee",
      recipientEmployeeId: brett.employeeId,
    });
    await removeRoute(harness.db, id);
    const routing = await listRouting(harness.db);
    assert.equal(routing.find((row) => row.category === "task_assigned")?.routes.length, 0);
  });
});

describe("home site address", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });

  it("is optional and starts empty on a home that has none", async () => {
    const home = await getHome(harness.db, "CLT2026TN903318X");
    assert.equal(home?.customer_name, null);
    assert.ok(formatSiteAddress(home!));
  });

  it("derives the matching keys from whatever was typed", async () => {
    await updateSiteAddress(harness.db, "hom_a2", {
      address: "184 mill creek road, lot 13",
      city: "Boone",
      state: "nc",
      postalCode: "28607",
      customerName: "Pat  O'Neill  Jr.",
      customerPhone: "+1 (828) 555-0123",
      customerEmail: "pat@example.com",
    });

    const home = await getHome(harness.db, "hom_a2");
    assert.equal(home?.site_address_key, "184 MILL CREEK RD UNIT 13|28607");
    assert.equal(home?.customer_name_key, "ONEILL PAT");
    assert.equal(home?.customer_phone_key, "8285550123");
    assert.equal(home?.site_state, "NC");

    const match = await matchHome(harness.db, { phone: "828-555-0123" });
    assert.equal(match.homeId, "hom_a2");
  });

  it("rejects a phone number or ZIP that cannot be right", async () => {
    await assert.rejects(updateSiteAddress(harness.db, "hom_a2", { customerPhone: "555-1234" }), /10-digit/);
    await assert.rejects(updateSiteAddress(harness.db, "hom_a2", { postalCode: "286" }), /ZIP should look like/);
    await assert.rejects(updateSiteAddress(harness.db, "hom_a2", { customerEmail: "nope" }), /email does not look right/);
  });

  it("clears the address and its keys when the fields are emptied", async () => {
    await updateSiteAddress(harness.db, "hom_a1", {});
    const home = await getHome(harness.db, "hom_a1");
    assert.equal(home?.site_address, null);
    assert.equal(home?.site_address_key, null);
    assert.equal(home?.customer_phone_key, null);
  });

  it("is editable by field crew, not just supervisors", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    assert.ok(can(dale, "home.address.edit"));
    assert.ok(!can(dale, "home.write"), "creating a home is still a supervisor's job");

    const response = await harness.request("/api/homes/hom_a2/site-address", {
      as: "dale@hplacer.com",
      ...form({ site_address: "184 Mill Creek Rd Lot 13", site_city: "Boone", site_state: "NC", site_postal_code: "28607" }),
    });
    assert.equal(response.status, 303);
    assert.equal((await getHome(harness.db, "hom_a2"))?.site_address, "184 Mill Creek Rd Lot 13");
  });

  it("is searchable by address and by owner", async () => {
    const byAddress = await listHomes(harness.db, { search: "BEND" });
    assert.deepEqual(byAddress.map((home) => home.serial_number), ["CLT2025TN881204Z"]);
    const byOwner = await listHomes(harness.db, { search: "WHITFIELD" });
    assert.deepEqual(byOwner.map((home) => home.serial_number), ["CAV2026NC114772A"]);
  });

  it("shows the address on the home page and offers the form", async () => {
    const page = await (await harness.request("/homes/hom_a1", { as: "dale@hplacer.com" })).text();
    assert.match(page, /184 Mill Creek Rd Lot 12/);
    assert.match(page, /Dana Whitfield/);
    assert.match(page, /Edit the site address/);
  });
});

describe("subdivisions", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("uses the word Subdivision throughout the UI", async () => {
    const list = await (await harness.request("/subdivisions", { as: "greg@hplacer.com" })).text();
    assert.match(list, /<h1>Subdivisions<\/h1>/);
    assert.match(list, /Search subdivision number/);
    assert.ok(!/<h1>Jobs<\/h1>/.test(list));

    const detail = await (await harness.request("/subdivisions/job_2601", { as: "greg@hplacer.com" })).text();
    assert.match(detail, /Subdivision documents/);
    assert.match(detail, /Subdivision folder/);
  });

  it("calls it a Subdivision on the records that reference one", async () => {
    const home = await (await harness.request("/homes/hom_a1", { as: "greg@hplacer.com" })).text();
    assert.match(home, /<dt>Subdivision<\/dt>/);
    assert.match(home, /href="\/subdivisions\/job_2601"/);
  });

  it("keeps the old /jobs paths working", async () => {
    assert.equal((await harness.request("/jobs", { as: "greg@hplacer.com" })).status, 200);
    assert.equal((await harness.request("/jobs/job_2601", { as: "greg@hplacer.com" })).status, 200);
    const legacy = await harness.json<{ subdivisions: unknown[]; jobs: unknown[] }>("/api/jobs", { as: "greg@hplacer.com" });
    assert.equal(legacy.jobs.length, legacy.subdivisions.length);
  });

  it("lets a field employee create and name one", async () => {
    const dale = await harness.actor("dale@hplacer.com");
    assert.ok(can(dale, "subdivision.create"));

    assert.equal((await harness.request("/subdivisions/new", { as: "dale@hplacer.com" })).status, 200);
    const response = await harness.request("/api/subdivisions", {
      as: "dale@hplacer.com",
      ...form({
        job_number: "HP-2711",
        title: "Deep Gap — Hollifield placement",
        street_address: "455 Deep Gap Road",
        city: "Boone",
        state: "NC",
        postal_code: "28607",
      }),
    });
    assert.equal(response.status, 303);

    const created = await getJob(harness.db, "HP-2711");
    assert.equal(created?.title, "Deep Gap — Hollifield placement");
    assert.equal(created?.address_key, "455 DEEP GAP RD|28607", "the address key is derived on create");
  });

  it("still holds editing lots to a supervisor", async () => {
    const response = await harness.request("/api/subdivisions/job_2601/lots", {
      as: "dale@hplacer.com",
      ...jsonBody({ lot_number: "99" }),
    });
    assert.equal(response.status, 403);
  });

  it("lists what a field employee created", async () => {
    const all = await listJobs(harness.db, {});
    assert.ok(all.some((subdivision) => subdivision.job_number === "HP-2711"));
  });
});
