import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { inbox, notify, unreadCount } from "../src/domain/notifications.ts";
import { createHarness, form, type Harness } from "./harness.ts";

describe("employee notification inbox", () => {
  let harness: Harness;
  let brandonId: string;
  let taraId: string;

  beforeEach(async () => {
    harness = await createHarness();
    brandonId = (await harness.actor("brandon@hplacer.com")).employeeId;
    taraId = (await harness.actor("tara@hplacer.com")).employeeId;
  });

  afterEach(() => harness?.close());

  it("shows unread first and keeps read history available in All", async () => {
    const unreadId = await notify(harness.db, {
      employeeId: brandonId,
      category: "task_assigned",
      title: "New task",
      body: "Check the site.",
      relatedType: "work_task",
      relatedId: "task_demo",
    });
    const historyId = await notify(harness.db, {
      employeeId: brandonId,
      category: "task_assigned",
      title: "Older task",
      body: "Already handled.",
    });
    assert.ok(unreadId && historyId);
    await harness.db.prepare("UPDATE notifications SET read_at = '2026-09-28T12:00:00Z' WHERE id = ?").bind(historyId).run();

    assert.deepEqual((await inbox(harness.db, brandonId, 50, true)).map((item) => item.id), [unreadId]);
    assert.equal((await inbox(harness.db, brandonId)).length, 2);
    const unreadPage = await harness.request("/notifications", { as: "brandon@hplacer.com" });
    const unreadHtml = await unreadPage.text();
    assert.match(unreadHtml, /Unread \(1\)/);
    assert.match(unreadHtml, /Open and mark read/);
    assert.doesNotMatch(unreadHtml, /Older task/);
    const allHtml = await (await harness.request("/notifications?view=all", { as: "brandon@hplacer.com" })).text();
    assert.match(allHtml, /Older task/);
  });

  it("marks a notification read when opening its related work, only for its owner", async () => {
    const id = await notify(harness.db, {
      employeeId: brandonId,
      category: "task_assigned",
      title: "New task",
      body: "Check the site.",
      relatedType: "work_task",
      relatedId: "task_demo",
    });
    assert.ok(id);

    const deniedOwner = await harness.request(`/api/notifications/${id}/open`, {
      ...form({}),
      as: "tara@hplacer.com",
    });
    assert.equal(deniedOwner.status, 303);
    assert.equal(deniedOwner.headers.get("location"), "/notifications");
    assert.equal(await unreadCount(harness.db, brandonId), 1);

    const opened = await harness.request(`/api/notifications/${id}/open`, {
      ...form({}),
      as: "brandon@hplacer.com",
    });
    assert.equal(opened.status, 303);
    assert.equal(opened.headers.get("location"), "/tasks/task_demo");
    assert.equal(await unreadCount(harness.db, brandonId), 0);
  });

  it("marks all of one employee's notifications read without touching another inbox", async () => {
    await notify(harness.db, { employeeId: brandonId, category: "task_assigned", title: "One", body: "First." });
    await notify(harness.db, { employeeId: brandonId, category: "task_assigned", title: "Two", body: "Second." });
    await notify(harness.db, { employeeId: taraId, category: "task_assigned", title: "Tara", body: "Separate." });

    const response = await harness.request("/api/notifications/read-all", {
      ...form({}),
      as: "brandon@hplacer.com",
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/notifications?ok=notifications_cleared");
    assert.equal(await unreadCount(harness.db, brandonId), 0);
    assert.equal(await unreadCount(harness.db, taraId), 1);
  });
});
