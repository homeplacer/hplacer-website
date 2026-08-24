import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { inbox } from "../src/domain/notifications.ts";
import { createHarness, form, jsonBody, type Harness } from "./harness.ts";

describe("Portable John workflow", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("lets an employee request delivery to a subdivision and routes it to operations", async () => {
    const response = await harness.request("/api/portable-john", {
      as: "dale@hplacer.com",
      ...form({ request_type: "delivery", requested_date: "2026-08-30", quantity: 2, job_id: "job_2601", location_details: "Inside the south gate beside lot 12", notes: "Gate code is with Greg" }),
    });
    assert.equal(response.status, 303);
    assert.match(response.headers.get("Location") ?? "", /^\/portable-john\/pjr_/);
    const request = await harness.db.prepare("SELECT * FROM portable_john_requests").first<{ request_type: string; job_id: string; requested_by: string }>();
    assert.deepEqual({ request_type: request?.request_type, job_id: request?.job_id, requested_by: request?.requested_by }, { request_type: "delivery", job_id: "job_2601", requested_by: "emp_dale" });
    const greg = await harness.actor("greg@hplacer.com");
    assert.ok((await inbox(harness.db, greg.employeeId)).some((item) => item.category === "portable_john_request"));
  });

  it("supports home and equipment pickup locations through the JSON API", async () => {
    for (const fields of [
      { request_type: "pickup", home_id: "hom_a1", location_details: "Unit behind the home" },
      { request_type: "pickup", asset_id: "ast_ex1", location_details: "Beside EX-01 at the yard" },
    ]) assert.equal((await harness.request("/api/portable-john", { as: "dale@hplacer.com", ...jsonBody(fields) })).status, 201);
    assert.equal((await harness.db.prepare("SELECT id FROM portable_john_requests").all()).results.length, 2);
  });

  it("requires exactly one related location", async () => {
    assert.equal((await harness.request("/api/portable-john", { as: "dale@hplacer.com", ...jsonBody({ request_type: "delivery", location_details: "At the site" }) })).status, 400);
    assert.equal((await harness.request("/api/portable-john", { as: "dale@hplacer.com", ...jsonBody({ request_type: "delivery", job_id: "job_2601", home_id: "hom_a1", location_details: "At the site" }) })).status, 400);
  });

  it("scopes employees to their requests and lets operations update the queue", async () => {
    const created = await harness.request("/api/portable-john", { as: "dale@hplacer.com", ...jsonBody({ request_type: "delivery", asset_id: "ast_ex1", location_details: "By the fuel tank" }) });
    const { id } = await created.json() as { id: string };
    assert.equal((await harness.request(`/portable-john/${id}`, { as: "marcus@hplacer.com" })).status, 403);
    assert.equal((await harness.request(`/api/portable-john/${id}/status`, { as: "dale@hplacer.com", ...jsonBody({ status: "scheduled" }) })).status, 403);
    assert.equal((await harness.request(`/api/portable-john/${id}/status`, { as: "greg@hplacer.com", ...jsonBody({ status: "scheduled", operations_notes: "Vendor booked for Monday" }) })).status, 200);
    const row = await harness.db.prepare("SELECT status, operations_notes FROM portable_john_requests WHERE id = ?").bind(id).first<{ status: string; operations_notes: string }>();
    assert.deepEqual({ ...row }, { status: "scheduled", operations_notes: "Vendor booked for Monday" });
  });

  it("renders the request entry point on the employee dashboard", async () => {
    assert.match(await (await harness.request("/", { as: "dale@hplacer.com" })).text(), /href="\/portable-john\/new">Portable John/);
    assert.equal((await harness.request("/portable-john/new", { as: "dale@hplacer.com" })).status, 200);
  });
});
