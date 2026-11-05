import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHarness, type Harness } from "./harness.ts";

function selectedAssets(...ids: string[]) {
  const body = new URLSearchParams();
  for (const id of ids) body.append("asset_id", id);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  };
}

describe("equipment at job sites and homes", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("assigns several machines to a job site and moves a selected machine to a home", async () => {
    const assigned = await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("ast_ex1", "ast_ex2"),
    });
    assert.equal(assigned.status, 303);

    let activeAtJob = await harness.db.prepare(
      "SELECT asset_id FROM asset_site_assignments WHERE job_id = 'job_2601' AND released_at IS NULL ORDER BY asset_id",
    ).all<{ asset_id: string }>();
    assert.deepEqual(activeAtJob.results.map((row) => row.asset_id), ["ast_ex1", "ast_ex2"]);

    const jobPage = await (await harness.request("/subdivisions/job_2601", { as: "brandon@hplacer.com" })).text();
    assert.match(jobPage, /Deere 135G/);
    assert.match(jobPage, /Kubota KX057-5/);

    const assignedToHome = await harness.request("/api/homes/hom_a1/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("ast_ex1"),
    });
    assert.equal(assignedToHome.status, 303);

    activeAtJob = await harness.db.prepare(
      "SELECT asset_id FROM asset_site_assignments WHERE job_id = 'job_2601' AND released_at IS NULL ORDER BY asset_id",
    ).all<{ asset_id: string }>();
    assert.deepEqual(activeAtJob.results.map((row) => row.asset_id), ["ast_ex2"]);

    const activeAtHome = await harness.db.prepare(
      "SELECT asset_id FROM asset_site_assignments WHERE home_id = 'hom_a1' AND released_at IS NULL",
    ).all<{ asset_id: string }>();
    assert.deepEqual(activeAtHome.results.map((row) => row.asset_id), ["ast_ex1"]);

    const history = await harness.db.prepare(
      "SELECT job_id, home_id, released_at FROM asset_site_assignments WHERE asset_id = 'ast_ex1' ORDER BY assigned_at",
    ).all<{ job_id: string | null; home_id: string | null; released_at: string | null }>();
    assert.equal(history.results.length, 2);
    assert.equal(history.results[0]?.job_id, "job_2601");
    assert.ok(history.results[0]?.released_at);
    assert.equal(history.results[1]?.home_id, "hom_a1");
    assert.equal(history.results[1]?.released_at, null);

    const homePage = await (await harness.request("/homes/hom_a1", { as: "brandon@hplacer.com" })).text();
    assert.match(homePage, /Equipment at this house/);
    assert.match(homePage, /Deere 135G/);
  });

  it("lets supervisors clear all machines and keeps equipment assignment restricted", async () => {
    await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("ast_ex1"),
    });
    const cleared = await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets(),
    });
    assert.equal(cleared.status, 303);
    assert.equal(await harness.db.prepare(
      "SELECT id FROM asset_site_assignments WHERE asset_id = 'ast_ex1' AND released_at IS NULL",
    ).first(), null);

    const denied = await harness.request("/api/homes/hom_a1/equipment", {
      as: "dale@hplacer.com",
      ...selectedAssets("ast_ex1"),
    });
    assert.equal(denied.status, 403);
  });

  it("rejects unknown or retired equipment without changing the current assignment", async () => {
    await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("ast_ex1"),
    });
    await harness.db.prepare("UPDATE assets SET status = 'retired' WHERE id = 'ast_ex2'").run();

    const retired = await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("ast_ex1", "ast_ex2"),
    });
    assert.equal(retired.status, 400);

    const missing = await harness.request("/api/subdivisions/job_2601/equipment", {
      as: "brandon@hplacer.com",
      ...selectedAssets("not-an-asset"),
    });
    assert.equal(missing.status, 404);

    const stillAssigned = await harness.db.prepare(
      "SELECT asset_id FROM asset_site_assignments WHERE job_id = 'job_2601' AND released_at IS NULL",
    ).all<{ asset_id: string }>();
    assert.deepEqual(stillAssigned.results.map((row) => row.asset_id), ["ast_ex1"]);
  });
});
