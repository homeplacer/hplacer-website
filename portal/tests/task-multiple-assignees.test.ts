import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readDocumentContent, uploadPhoto } from "../src/domain/documents.ts";
import { inbox } from "../src/domain/notifications.ts";
import { completeTask, createTask, listTasks, requireTask } from "../src/domain/tasks.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("multiple task assignees", () => {
  let h: Harness;
  beforeEach(async () => { h = await createHarness(); });
  afterEach(() => h.close());

  it("assigns one task to several employees through the form and lets each person work it", async () => {
    const brandon = await h.actor("brandon@hplacer.com");
    const marcus = await h.actor("marcus@hplacer.com");
    const nina = await h.actor("nina@hplacer.com");
    const stranger = await h.actor("wes@hplacer.com");

    const assignmentPage = await h.request("/tasks/new", { as: brandon.email });
    const page = await assignmentPage.text();
    assert.match(page, /Assign to people/);
    assert.match(page, /name="assigned_to"/);

    const fields = new URLSearchParams({ title: "Set the home on its pad", job_id: "job_2601" });
    fields.append("assigned_to", marcus.employeeId);
    fields.append("assigned_to", nina.employeeId);
    const response = await h.request("/api/tasks", {
      as: brandon.email,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fields.toString(),
    });
    assert.equal(response.status, 303);
    const taskId = /\/tasks\/([^?]+)/.exec(response.headers.get("location") ?? "")?.[1];
    assert.ok(taskId);

    const task = await requireTask(h.db, taskId);
    assert.equal(task.assigned_to, marcus.employeeId);
    assert.deepEqual((task.assignee_ids ?? "").split(",").sort(), [marcus.employeeId, nina.employeeId].sort());
    assert.match(task.assignee_name ?? "", /Marcus/);
    assert.match(task.assignee_name ?? "", /Nina/);

    for (const person of [marcus, nina]) {
      assert.ok((await listTasks(h.db, person, { assignedTo: person.employeeId, openOnly: true })).some((item) => item.id === taskId));
      assert.ok((await inbox(h.db, person.employeeId)).some((notice) => notice.related_id === taskId));
      assert.equal((await h.request(`/tasks/${taskId}`, { as: person.email })).status, 200);
    }
    assert.equal((await h.request(`/tasks/${taskId}`, { as: stranger.email })).status, 403);

    const photoId = await uploadPhoto(h.db, h.store, marcus.employeeId, {
      documentType: "photo",
      fileName: "pad.jpg",
      contentType: "image/png",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer,
      target: { workTaskId: taskId },
    });
    assert.equal((await readDocumentContent(h.db, h.store, nina, photoId)).bytes.byteLength, 8);
    await assert.rejects(readDocumentContent(h.db, h.store, stranger, photoId), /do not have access/);

    await completeTask(h.db, nina, { taskId, notes: "Pad work is complete." });
    const completed = await requireTask(h.db, taskId);
    assert.equal(completed.status, "complete");
    assert.equal(completed.completed_by, nina.employeeId);
  });

  it("updates the whole assignee list and clears it when no one is selected", async () => {
    const brandon = await h.actor("brandon@hplacer.com");
    const marcus = await h.actor("marcus@hplacer.com");
    const nina = await h.actor("nina@hplacer.com");
    const id = await createTask(h.db, brandon, {
      title: "Prepare the water connection",
      assignedToIds: [marcus.employeeId, nina.employeeId],
    });

    const revised = new URLSearchParams();
    revised.append("assigned_to", nina.employeeId);
    const changed = await h.request(`/api/tasks/${id}/assign`, {
      as: brandon.email,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: revised.toString(),
    });
    assert.equal(changed.status, 303);
    assert.equal((await requireTask(h.db, id)).assignee_ids, nina.employeeId);
    assert.equal((await listTasks(h.db, marcus, { assignedTo: marcus.employeeId, openOnly: true })).some((item) => item.id === id), false);

    const unassigned = await h.request(`/api/tasks/${id}/assign`, {
      as: brandon.email,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(unassigned.status, 303);
    const task = await requireTask(h.db, id);
    assert.equal(task.assigned_to, null);
    assert.equal(task.assignee_ids, null);
  });

});
