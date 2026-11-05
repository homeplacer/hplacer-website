import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHarness, type Harness } from "./harness.ts";

function taskForm(fields: Record<string, string>, assetIds: string[] = []) {
  const body = new URLSearchParams(fields);
  for (const id of assetIds) body.append("asset_ids", id);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  };
}

describe("equipment to move on an assigned task", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("lets a supervisor assign several named machines to a destination and shows them to the crew", async () => {
    await harness.db.prepare("UPDATE homes SET site_address = '123 Main Street' WHERE id = 'hom_a1'").run();
    const response = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      ...taskForm({
        title: "Move equipment to the house",
        assigned_to: "emp_dale",
        job_id: "job_2601",
        home_id: "hom_a1",
      }, ["ast_ex1", "ast_ex2"]),
    });
    assert.equal(response.status, 303);

    const task = await harness.db.prepare(
      "SELECT id, job_id, home_id, asset_id FROM work_tasks WHERE title = ?",
    ).bind("Move equipment to the house").first<{ id: string; job_id: string; home_id: string; asset_id: string }>();
    assert.ok(task);
    assert.equal(task.job_id, "job_2601");
    assert.equal(task.home_id, "hom_a1");
    assert.equal(task.asset_id, "ast_ex1");

    const links = await harness.db.prepare(
      "SELECT asset_id FROM work_task_assets WHERE work_task_id = ? ORDER BY asset_id",
    ).bind(task.id).all<{ asset_id: string }>();
    assert.deepEqual(links.results.map((row) => row.asset_id), ["ast_ex1", "ast_ex2"]);

    const page = await (await harness.request(`/tasks/${task.id}`, { as: "dale@hplacer.com" })).text();
    assert.match(page, /HP-2601/);
    assert.match(page, /123 Main Street/);
    assert.match(page, /Deere 135G \(2021\) — EX-01/);
    assert.match(page, /Kubota KX057-5 \(2023\) — EX-02/);
    assert.match(page, /Equipment to move/);

    const taskList = await (await harness.request("/tasks", { as: "dale@hplacer.com" })).text();
    assert.match(taskList, /2 machines to move/);

    const siteAssignments = await harness.db.prepare(
      "SELECT asset_id FROM asset_site_assignments WHERE released_at IS NULL",
    ).all<{ asset_id: string }>();
    assert.equal(siteAssignments.results.length, 0, "creating the task must not pretend the machines have already moved");
  });

  it("requires a destination and rejects unknown or retired equipment without creating a task", async () => {
    const noDestination = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      ...taskForm({ title: "Move it" }, ["ast_ex1"]),
    });
    assert.equal(noDestination.status, 400);

    const unknown = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      ...taskForm({ title: "Move it", job_id: "job_2601" }, ["not-an-asset"]),
    });
    assert.equal(unknown.status, 404);

    await harness.db.prepare("UPDATE assets SET status = 'retired' WHERE id = 'ast_ex2'").run();
    const retired = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      ...taskForm({ title: "Move it", job_id: "job_2601" }, ["ast_ex1", "ast_ex2"]),
    });
    assert.equal(retired.status, 400);

    const count = await harness.db.prepare("SELECT count(*) AS n FROM work_tasks WHERE title = 'Move it'").first<{ n: number }>();
    assert.equal(count?.n, 0);
  });

  it("does not let a task point a house at the wrong subdivision", async () => {
    const response = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      ...taskForm({ title: "Move it", job_id: "job_2604", home_id: "hom_a1" }, ["ast_ex1"]),
    });
    assert.equal(response.status, 400);
    const count = await harness.db.prepare("SELECT count(*) AS n FROM work_tasks WHERE title = 'Move it'")
      .first<{ n: number }>();
    assert.equal(count?.n, 0);
  });

  it("accepts equipment ID lists through the JSON task API", async () => {
    const response = await harness.request("/api/tasks", {
      as: "brandon@hplacer.com",
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ title: "Move the pair", home_id: "hom_a1", asset_ids: ["ast_ex1", "ast_ex2"] }),
    });
    assert.equal(response.status, 201);
    const { id } = await response.json() as { id: string };
    const count = await harness.db.prepare("SELECT count(*) AS n FROM work_task_assets WHERE work_task_id = ?")
      .bind(id).first<{ n: number }>();
    assert.equal(count?.n, 2);
  });
});
