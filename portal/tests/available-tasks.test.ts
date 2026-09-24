import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { completeTask, createTask, requireTask, setTaskStatus } from "../src/domain/tasks.ts";
import { createHarness, jsonBody, type Harness } from "./harness.ts";

describe("available job tasks", () => {
  let h: Harness;
  beforeEach(async () => { h = await createHarness(); });
  afterEach(() => h.close());

  async function task(extra = {}) {
    return createTask(h.db, await h.actor("brandon@hplacer.com"), {
      title: "Finish shared pad work", jobId: "job_2601", ...extra,
    });
  }

  it("lets an employee discover and complete an unassigned job task with attribution", async () => {
    const id = await task();
    const as = "marcus@hplacer.com";
    const list = await (await h.request("/tasks?scope=available", { as })).text();
    assert.ok(list.includes(`/tasks/${id}`));
    const api = await h.json<{ tasks: { id: string }[] }>("/api/tasks?scope=available", { as });
    assert.ok(api.tasks.some(t => t.id === id));
    assert.equal((await h.request(`/tasks/${id}`, { as })).status, 200);
    const completed = await h.request(`/api/tasks/${id}/complete`, { as, ...jsonBody({ notes: "Pad leveled." }) });
    assert.ok(completed.status < 400);
    const record = await requireTask(h.db, id);
    const actor = await h.actor(as);
    assert.equal(record.completed_by, actor.employeeId);
    assert.equal(record.assigned_to, null);
    assert.equal(record.status, "complete");
    const detail = await (await h.request(`/tasks/${id}`, { as })).text();
    assert.ok(detail.includes("Completed by"));
    assert.ok(detail.includes(actor.displayName));
    const remaining = await h.json<{ tasks: { id: string }[] }>("/api/tasks?scope=available", { as });
    assert.ok(!remaining.tasks.some(t => t.id === id));
  });

  it("keeps unrelated unassigned tasks and another employee's assigned work private", async () => {
    const marcus = await h.actor("marcus@hplacer.com");
    for (const id of [await task({ jobId: null }), await task({ assignedTo: marcus.employeeId })]) {
      const as = "nina@hplacer.com";
      assert.equal((await h.request(`/tasks/${id}`, { as })).status, 403);
      assert.equal((await h.request(`/api/tasks/${id}/complete`, { as, ...jsonBody({ notes: "Done" }) })).status, 403);
      const available = await h.json<{ tasks: { id: string }[] }>("/api/tasks?scope=available", { as });
      assert.ok(!available.tasks.some(t => t.id === id));
    }
  });

  it("still requires completion notes and required photos", async () => {
    const id = await task({ requiresPhoto: true });
    for (const notes of ["", "Done without a photo"]) {
      const result = await h.request(`/api/tasks/${id}/complete`, { as: "marcus@hplacer.com", ...jsonBody({ notes }) });
      assert.equal(result.status, 400);
      assert.equal((await requireTask(h.db, id)).status, "open");
    }
  });

  it("requires a stored photo rather than a non-photo attachment", async () => {
    const id = await task({ requiresPhoto: true });
    const actor = await h.actor("marcus@hplacer.com");
    await h.db.prepare(`INSERT INTO documents
      (id, document_type, storage_provider, storage_key, file_name, upload_status, work_task_id, uploaded_by, created_at)
      VALUES ('task_attachment', 'permit', 'r2', 'permit.pdf', 'permit.pdf', 'stored', ?, ?, CURRENT_TIMESTAMP)`)
      .bind(id, actor.employeeId).run();
    const finish = () => h.request(`/api/tasks/${id}/complete`, {
      as: actor.email, ...jsonBody({ notes: "Work finished" }),
    });
    assert.equal((await finish()).status, 400);
    await h.db.prepare("UPDATE documents SET document_type = 'photo', file_name = 'work.jpg' WHERE id = 'task_attachment'").run();
    assert.ok((await finish()).status < 400);
  });

  it("records only one completion when two employees finish together", async () => {
    const id = await task();
    const marcus = await h.actor("marcus@hplacer.com");
    const nina = await h.actor("nina@hplacer.com");
    const results = await Promise.allSettled([
      completeTask(h.db, marcus, { taskId: id, notes: "Marcus finished" }),
      completeTask(h.db, nina, { taskId: id, notes: "Nina finished" }),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const winner = results[0].status === "fulfilled" ? marcus : nina;
    assert.equal((await requireTask(h.db, id)).completed_by, winner.employeeId);
  });

  it("hides cancelled work and shows available work on the job page", async () => {
    const id = await task();
    const as = "marcus@hplacer.com";
    const page = await (await h.request("/subdivisions/job_2601", { as })).text();
    assert.ok(page.includes(`/tasks/${id}`));
    await setTaskStatus(h.db, await h.actor("brandon@hplacer.com"), id, "cancelled");
    const available = await h.json<{ tasks: { id: string }[] }>("/api/tasks?scope=available", { as });
    assert.ok(!available.tasks.some(t => t.id === id));
  });
});
