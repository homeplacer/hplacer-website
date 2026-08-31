import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Actor } from "../src/auth/authz.ts";
import { evaluateSchedule, getAsset, listAssets, notifyServiceDue, recordService } from "../src/domain/assets.ts";
import { listDefects } from "../src/domain/defects.ts";
import { getHome, homeReports } from "../src/domain/homes.ts";
import { submitInspection, todaysInspection, type AnswerInput } from "../src/domain/inspections.ts";
import { inbox } from "../src/domain/notifications.ts";
import { completeTask, createTask, listTasks } from "../src/domain/tasks.ts";
import { createHarness, type Harness } from "./harness.ts";

const PASSING_EXCAVATOR: AnswerInput[] = [
  "walkaround",
  "engine_oil",
  "hydraulic_fluid",
  "coolant",
  "tracks",
  "bucket_teeth",
  "controls",
  "seatbelt",
  "fire_ext",
].map((checklistKey) => ({ checklistKey, result: "pass" }));

describe("daily pre-use inspection", () => {
  let harness: Harness;
  let dale: Actor;

  beforeEach(async () => {
    harness = await createHarness();
    dale = await harness.actor("dale@hplacer.com");
  });

  it("files a clean inspection and records the meter", async () => {
    const result = await submitInspection(harness.db, dale, {
      templateKey: "daily_excavator",
      assetId: "ast_ex1",
      meterReading: 3190,
      answers: PASSING_EXCAVATOR,
    });
    assert.equal(result.status, "passed");
    assert.equal(result.defectIds.length, 0);
    assert.equal(result.assetTakenOutOfService, false);

    const asset = await getAsset(harness.db, "ast_ex1");
    assert.equal(asset?.hour_meter, 3190);
    assert.equal(asset?.status, "available");

    const reading = await harness.db
      .prepare("SELECT reading_type, value, source FROM asset_meter_readings WHERE asset_id = 'ast_ex1' ORDER BY recorded_at DESC")
      .first<{ reading_type: string; value: number; source: string }>();
    assert.deepEqual({ ...reading }, { reading_type: "hours", value: 3190, source: "inspection" });
  });

  it("opens a defect per failure and tags out the machine on a critical one", async () => {
    const result = await submitInspection(harness.db, dale, {
      templateKey: "daily_excavator",
      assetId: "ast_ex1",
      meterReading: 3190,
      answers: PASSING_EXCAVATOR.map((answer) =>
        answer.checklistKey === "hydraulic_fluid"
          ? { ...answer, result: "fail" as const, notes: "Weeping at the boom cylinder." }
          : answer.checklistKey === "bucket_teeth"
            ? { ...answer, result: "fail" as const, notes: "Two teeth missing." }
            : answer,
      ),
    });

    assert.equal(result.status, "defect_found");
    assert.equal(result.defectIds.length, 2);
    assert.equal(result.assetTakenOutOfService, true);

    const asset = await getAsset(harness.db, "ast_ex1");
    assert.equal(asset?.status, "out_of_service");
    assert.match(asset?.out_of_service_reason ?? "", /Hydraulic fluid/);

    const defects = await listDefects(harness.db, { assetId: "ast_ex1", openOnly: true });
    assert.deepEqual(defects.map((defect) => defect.severity).sort(), ["critical", "major"]);

    // Supervisors are told; the operator is not spammed with their own report.
    const brandon = await harness.actor("brandon@hplacer.com");
    const notices = await inbox(harness.db, brandon.employeeId);
    assert.ok(notices.some((notice) => notice.category === "inspection_failed" && notice.severity === "urgent"));
  });

  it("insists on a note for a failed line", async () => {
    await assert.rejects(
      submitInspection(harness.db, dale, {
        templateKey: "daily_excavator",
        assetId: "ast_ex1",
        meterReading: 3190,
        answers: PASSING_EXCAVATOR.map((answer) => (answer.checklistKey === "coolant" ? { ...answer, result: "fail" as const } : answer)),
      }),
      /Describe the problem/,
    );
  });

  it("insists on an answer for every line", async () => {
    await assert.rejects(
      submitInspection(harness.db, dale, {
        templateKey: "daily_excavator",
        assetId: "ast_ex1",
        meterReading: 3190,
        answers: PASSING_EXCAVATOR.slice(0, 4),
      }),
      /Answer every line/,
    );
  });

  it("catches a meter reading that runs backwards", async () => {
    await assert.rejects(
      submitInspection(harness.db, dale, {
        templateKey: "daily_excavator",
        assetId: "ast_ex1",
        meterReading: 12,
        answers: PASSING_EXCAVATOR,
      }),
      /reads lower than the last recorded/,
    );
  });

  it("requires the meter reading the checklist asks for", async () => {
    await assert.rejects(
      submitInspection(harness.db, dale, { templateKey: "daily_excavator", assetId: "ast_ex1", answers: PASSING_EXCAVATOR }),
      /Enter the hour meter reading/,
    );
  });

  it("refuses a second pre-use inspection from the same operator the same day", async () => {
    const now = new Date("2026-08-21T07:00:00Z");
    await submitInspection(harness.db, dale, { templateKey: "daily_excavator", assetId: "ast_ex1", meterReading: 3190, answers: PASSING_EXCAVATOR }, now);
    await assert.rejects(
      submitInspection(harness.db, dale, { templateKey: "daily_excavator", assetId: "ast_ex1", meterReading: 3191, answers: PASSING_EXCAVATOR }, new Date("2026-08-21T16:00:00Z")),
      /already filed a pre-use inspection for EX-01 today/,
    );
    assert.ok(await todaysInspection(harness.db, "ast_ex1", dale.employeeId, now));
  });

  it("refuses to inspect a retired machine", async () => {
    await harness.db.prepare("UPDATE assets SET status = 'retired' WHERE id = 'ast_ex1'").run();
    await assert.rejects(
      submitInspection(harness.db, dale, { templateKey: "daily_excavator", assetId: "ast_ex1", meterReading: 3190, answers: PASSING_EXCAVATOR }),
      /retired and cannot be inspected/,
    );
  });
});

describe("home reports", () => {
  let harness: Harness;
  let brandon: Actor;

  before(async () => {
    harness = await createHarness();
    brandon = await harness.actor("brandon@hplacer.com");
  });
  after(() => harness.close());

  it("advances the home's milestones as each report is filed", async () => {
    const home = await getHome(harness.db, "CLT2026TN903318X");
    assert.equal(home?.status, "delivery_pending");

    const deliveryAnswers: AnswerInput[] = [
      "serial_verified",
      "hud_labels",
      "exterior_damage",
      "glass",
      "interior_damage",
      "ship_loose",
      "site_access",
      "placement",
    ].map((checklistKey) => ({ checklistKey, result: "pass" as const }));

    await submitInspection(
      harness.db,
      brandon,
      {
        templateKey: "home_delivery",
        homeId: home!.id,
        answers: deliveryAnswers,
        fields: [{ key: "transporter", label: "Transport company", value: "Ridgeline Transport" }],
      },
      new Date("2026-08-21T10:00:00Z"),
    );

    const afterDelivery = await getHome(harness.db, home!.id);
    assert.equal(afterDelivery?.status, "installed");
    assert.equal(afterDelivery?.delivered_on, "2026-08-21");

    const reports = await homeReports(harness.db, home!.id);
    const delivery = reports.find((report) => report.kind === "delivery");
    assert.equal(delivery?.status, "passed");
    assert.equal(delivery?.performed_by_name, "Brandon");
    assert.equal(reports.find((report) => report.kind === "setup")?.inspection_id, null);

    const stored = await harness.db
      .prepare("SELECT label, value FROM inspection_fields WHERE inspection_id = ?")
      .bind(delivery!.inspection_id)
      .first<{ label: string; value: string }>();
    assert.deepEqual({ ...stored }, { label: "Transport company", value: "Ridgeline Transport" });
  });
});

describe("service intervals", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("counts down against hours, miles, and calendar days", () => {
    const base = {
      id: "s",
      asset_id: "a",
      service_key: "k",
      description: "d",
      interval_hours: 250,
      interval_miles: null,
      interval_days: null,
      last_service_at: null,
      last_service_hours: 3000,
      last_service_miles: null,
      active: 1,
    };
    assert.equal(evaluateSchedule(base, { hour_meter: 3100, odometer: null }).hours_remaining, 150);
    assert.equal(evaluateSchedule(base, { hour_meter: 3100, odometer: null }).due, false);
    assert.equal(evaluateSchedule(base, { hour_meter: 3240, odometer: null }).due, true);
    assert.equal(evaluateSchedule(base, { hour_meter: 3300, odometer: null }).overdue, true);

    const byDays = { ...base, interval_hours: null, interval_days: 365, last_service_at: "2025-11-14 10:00:00" };
    const inWindow = evaluateSchedule(byDays, { hour_meter: null, odometer: null }, new Date("2026-08-21T12:00:00Z"));
    assert.equal(Math.round(inWindow.days_remaining ?? 0), 85);
    assert.equal(inWindow.due, false);
    const pastDue = evaluateSchedule(byDays, { hour_meter: null, odometer: null }, new Date("2026-11-20T12:00:00Z"));
    assert.ok(pastDue.overdue, "an annual inspection last done 2025-11-14 is overdue by 2026-11-20");
    const almostDue = evaluateSchedule(byDays, { hour_meter: null, odometer: null }, new Date("2026-11-10T12:00:00Z"));
    assert.equal(almostDue.due, true, "within a week counts as due soon");
    assert.equal(almostDue.overdue, false);
  });

  it("notifies supervisors once per condition", async () => {
    const first = await notifyServiceDue(harness.db, new Date("2026-08-21T12:00:00Z"));
    assert.ok(first > 0);
    const second = await notifyServiceDue(harness.db, new Date("2026-08-21T13:00:00Z"));
    assert.equal(second, 0, "the dedupe key suppresses the repeat");
  });

  it("resets the countdown when the work is recorded", async () => {
    const wes = await harness.actor("wes@hplacer.com");
    await recordService(harness.db, {
      assetId: "ast_dt1",
      scheduleId: "svs_dt1_dot",
      serviceType: "inspection",
      description: "DOT annual inspection",
      odometer: 118500,
      performedBy: wes.employeeId,
      now: new Date("2026-08-21T12:00:00Z"),
    });
    const schedule = await harness.db
      .prepare("SELECT * FROM asset_service_schedules WHERE id = 'svs_dt1_dot'")
      .first<Parameters<typeof evaluateSchedule>[0]>();
    const asset = await getAsset(harness.db, "ast_dt1");
    const evaluated = evaluateSchedule(schedule!, asset!, new Date("2026-08-22T12:00:00Z"));
    assert.equal(evaluated.overdue, false);
    assert.equal(asset?.odometer, 118500);
  });

  it("keeps every reading, even a corrected one", async () => {
    const readings = await harness.db
      .prepare("SELECT count(*) AS n FROM asset_meter_readings WHERE asset_id = 'ast_dt1'")
      .first<{ n: number }>();
    assert.ok((readings?.n ?? 0) >= 1);
  });
});

describe("tasks and completion evidence", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("notifies the assignee and shows the task in their list", async () => {
    const brandon = await harness.actor("brandon@hplacer.com");
    const marcus = await harness.actor("marcus@hplacer.com");
    const id = await createTask(harness.db, brandon, {
      title: "Set anchors on lot 13",
      assignedTo: marcus.employeeId,
      priority: "high",
      dueAt: "2026-08-26",
      requiresPhoto: true,
    });

    const notices = await inbox(harness.db, marcus.employeeId);
    assert.ok(notices.some((notice) => notice.related_id === id && notice.category === "task_assigned"));

    const mine = await listTasks(harness.db, marcus, { assignedTo: marcus.employeeId, openOnly: true });
    assert.ok(mine.some((task) => task.id === id));
  });

  it("will not close a photo-required task without a photo", async () => {
    const brandon = await harness.actor("brandon@hplacer.com");
    const marcus = await harness.actor("marcus@hplacer.com");
    const id = await createTask(harness.db, brandon, { title: "Photograph the finished set", assignedTo: marcus.employeeId, requiresPhoto: true });

    await assert.rejects(completeTask(harness.db, marcus, { taskId: id, notes: "Done" }), /needs a photo/);

    await harness.db
      .prepare(
        `INSERT INTO documents (id, document_type, storage_provider, storage_key, file_name, upload_status, work_task_id, uploaded_by, created_at)
         VALUES ('doc_evidence', 'photo', 'r2', 'photos/x.jpg', 'x.jpg', 'stored', ?, ?, '2026-08-21 12:00:00')`,
      )
      .bind(id, marcus.employeeId)
      .run();

    await completeTask(harness.db, marcus, { taskId: id, notes: "Photographed both ends." });
    const task = await harness.db.prepare("SELECT status, completed_by FROM work_tasks WHERE id = ?").bind(id).first<{ status: string; completed_by: string }>();
    assert.equal(task?.status, "complete");
    assert.equal(task?.completed_by, marcus.employeeId);
  });

  it("insists on completion notes", async () => {
    const brandon = await harness.actor("brandon@hplacer.com");
    const id = await createTask(harness.db, brandon, { title: "Return the plate compactor", assignedTo: brandon.employeeId });
    await assert.rejects(completeTask(harness.db, brandon, { taskId: id, notes: "  " }), /Say what you did/);
  });

  it("keeps one crew member out of another's task", async () => {
    const brandon = await harness.actor("brandon@hplacer.com");
    const marcus = await harness.actor("marcus@hplacer.com");
    const nina = await harness.actor("nina@hplacer.com");
    const id = await createTask(harness.db, brandon, { title: "Haul the skirting", assignedTo: marcus.employeeId });
    await assert.rejects(completeTask(harness.db, nina, { taskId: id, notes: "I did it" }), /assigned to someone else/);
  });

  it("scopes the task list by role", async () => {
    const nina = await harness.actor("nina@hplacer.com");
    const brandon = await harness.actor("brandon@hplacer.com");
    const forNina = await listTasks(harness.db, nina, {});
    assert.ok(forNina.every((task) => task.assigned_to === nina.employeeId || task.created_by === nina.employeeId));
    const forBrandon = await listTasks(harness.db, brandon, {});
    assert.ok(forBrandon.some((task) => task.assigned_to !== brandon.employeeId && task.created_by !== brandon.employeeId));
  });

  it("only offers active assignees", async () => {
    const brandon = await harness.actor("brandon@hplacer.com");
    await harness.db.prepare("UPDATE employees SET active = 0 WHERE id = 'emp_wes'").run();
    await assert.rejects(createTask(harness.db, brandon, { title: "x", assignedTo: "emp_wes" }), /deactivated/);
    await harness.db.prepare("UPDATE employees SET active = 1 WHERE id = 'emp_wes'").run();
  });
});

describe("fleet listing", () => {
  it("counts open defects and last inspection per machine", async () => {
    const harness = await createHarness();
    const assets = await listAssets(harness.db, { type: "skid_steer" });
    const ss2 = assets.find((asset) => asset.asset_tag === "SS-02");
    assert.equal(ss2?.status, "out_of_service");
    assert.equal(typeof ss2?.open_defect_count, "number");
    harness.close();
  });
});
