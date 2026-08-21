/**
 * Checklist-driven inspections: daily pre-use equipment checks and the
 * delivery / setup / final-inspection home reports.
 *
 * Submitting an inspection is the busiest write in the portal, so it does the
 * bookkeeping the crew would otherwise forget: it opens a defect for every
 * failed line, pulls a critical machine out of service, files the meter
 * reading, advances the home's milestone dates, and tells the supervisors.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { newId, nowIso, todayIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import type { Actor } from "../auth/authz.ts";
import { notifyCategory } from "./notifications.ts";

export type InspectionKind = "daily_equipment" | "delivery" | "setup" | "final_inspection";
export type AnswerResult = "pass" | "fail" | "not_applicable";

export interface ChecklistTemplateRow {
  id: string;
  template_key: string;
  name: string;
  inspection_kind: string;
  applies_to: string;
  asset_type: string | null;
  meter_prompt: string | null;
  active: number;
}

export interface ChecklistItemRow {
  id: string;
  template_id: string;
  checklist_key: string;
  question: string;
  sort_order: number;
  critical: number;
  requires_note_on_fail: number;
}

export interface ChecklistTemplate extends ChecklistTemplateRow {
  items: ChecklistItemRow[];
}

export interface InspectionRow {
  id: string;
  inspection_kind: string;
  status: string;
  asset_id: string | null;
  home_id: string | null;
  job_id: string | null;
  lot_id: string | null;
  template_id: string | null;
  performed_by: string;
  performed_at: string;
  meter_reading: number | null;
  odometer: number | null;
  notes: string | null;
  submitted_at: string | null;
}

export interface AnswerInput {
  checklistKey: string;
  result: AnswerResult;
  notes?: string | null;
}

export interface SubmitInspectionInput {
  templateKey: string;
  assetId?: string | null;
  homeId?: string | null;
  jobId?: string | null;
  lotId?: string | null;
  meterReading?: number | null;
  odometer?: number | null;
  notes?: string | null;
  answers: AnswerInput[];
  fields?: { key: string; label: string; value: string | null }[];
}

export interface SubmitInspectionResult {
  inspectionId: string;
  status: "passed" | "defect_found";
  defectIds: string[];
  assetTakenOutOfService: boolean;
}

export async function loadTemplate(db: Db, templateKey: string): Promise<ChecklistTemplate> {
  const template = await db
    .prepare("SELECT * FROM checklist_templates WHERE template_key = ? AND active = 1")
    .bind(templateKey)
    .first<ChecklistTemplateRow>();
  if (!template) throw notFound(`No active checklist named "${templateKey}"`);

  const items = await db
    .prepare("SELECT * FROM checklist_items WHERE template_id = ? ORDER BY sort_order, checklist_key")
    .bind(template.id)
    .all<ChecklistItemRow>();
  return { ...template, items: items.results };
}

/** The pre-use checklist for a machine, falling back to the generic one. */
export async function templateForAssetType(db: Db, assetType: string): Promise<ChecklistTemplate> {
  const row = await db
    .prepare(
      `SELECT template_key FROM checklist_templates
        WHERE inspection_kind = 'daily_equipment' AND active = 1 AND asset_type = ?`,
    )
    .bind(assetType)
    .first<{ template_key: string }>();
  return loadTemplate(db, row?.template_key ?? "daily_other");
}

export async function listTemplates(db: Db, kind?: InspectionKind): Promise<ChecklistTemplateRow[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM checklist_templates WHERE active = 1 AND (?1 IS NULL OR inspection_kind = ?1)
        ORDER BY applies_to, inspection_kind, name`,
    )
    .bind(kind ?? null)
    .all<ChecklistTemplateRow>();
  return rows.results;
}

export async function submitInspection(
  db: Db,
  actor: Actor,
  input: SubmitInspectionInput,
  now: Date = new Date(),
): Promise<SubmitInspectionResult> {
  const template = await loadTemplate(db, input.templateKey);

  if (template.applies_to === "asset" && !input.assetId) throw badRequest("Choose the machine being inspected");
  if (template.applies_to === "home" && !input.homeId) throw badRequest("Choose the home being inspected");
  if (input.assetId && input.homeId) throw badRequest("An inspection covers a machine or a home, not both");

  const asset = input.assetId
    ? await db
        .prepare("SELECT id, asset_tag, asset_type, hour_meter, odometer, status FROM assets WHERE id = ?")
        .bind(input.assetId)
        .first<{ id: string; asset_tag: string; asset_type: string; hour_meter: number | null; odometer: number | null; status: string }>()
    : null;
  if (input.assetId && !asset) throw notFound("Equipment not found");
  if (asset && asset.status === "retired") throw conflict(`${asset.asset_tag} is retired and cannot be inspected`);

  const home = input.homeId
    ? await db
        .prepare("SELECT id, serial_number, job_id, lot_id FROM homes WHERE id = ?")
        .bind(input.homeId)
        .first<{ id: string; serial_number: string; job_id: string | null; lot_id: string | null }>()
    : null;
  if (input.homeId && !home) throw notFound("Home not found");

  // Meter capture is part of the pre-use check, not an optional extra.
  let meterReading = input.meterReading ?? null;
  let odometer = input.odometer ?? null;
  if (template.meter_prompt === "hours") {
    if (meterReading == null || Number.isNaN(meterReading)) throw badRequest("Enter the hour meter reading");
    if (meterReading < 0) throw badRequest("Hour meter cannot be negative");
    if (asset?.hour_meter != null && meterReading + 0.001 < asset.hour_meter) {
      throw badRequest(`Hour meter reads lower than the last recorded ${asset.hour_meter}. Re-check the meter.`);
    }
  } else if (template.meter_prompt === "miles") {
    if (odometer == null || Number.isNaN(odometer)) throw badRequest("Enter the odometer reading");
    if (odometer < 0) throw badRequest("Odometer cannot be negative");
    if (asset?.odometer != null && odometer < asset.odometer) {
      throw badRequest(`Odometer reads lower than the last recorded ${asset.odometer}. Re-check the dash.`);
    }
  } else {
    meterReading = null;
    odometer = null;
  }

  const answersByKey = new Map(input.answers.map((answer) => [answer.checklistKey, answer]));
  const failures: { item: ChecklistItemRow; answer: AnswerInput }[] = [];
  for (const item of template.items) {
    const answer = answersByKey.get(item.checklist_key);
    if (!answer) throw badRequest(`Answer every line — "${item.question}" is blank`);
    if (!["pass", "fail", "not_applicable"].includes(answer.result)) {
      throw badRequest(`"${answer.result}" is not a valid answer`);
    }
    if (answer.result === "fail") {
      if (item.requires_note_on_fail === 1 && !answer.notes?.trim()) {
        throw badRequest(`Describe the problem with "${item.question}"`);
      }
      failures.push({ item, answer });
    }
  }

  const status = failures.length > 0 ? "defect_found" : "passed";
  const timestamp = nowIso(now);
  const inspectionId = newId("insp");

  try {
    await db
      .prepare(
        `INSERT INTO inspections (id, inspection_kind, status, asset_id, home_id, job_id, lot_id, template_id,
                                  performed_by, performed_at, meter_reading, odometer, notes, submitted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        inspectionId,
        template.inspection_kind,
        status,
        input.assetId ?? null,
        input.homeId ?? null,
        input.jobId ?? home?.job_id ?? null,
        input.lotId ?? home?.lot_id ?? null,
        template.id,
        actor.employeeId,
        timestamp,
        meterReading,
        odometer,
        input.notes?.trim() || null,
        timestamp,
        timestamp,
      )
      .run();
  } catch (error) {
    if (String(error).includes("idx_daily_equipment_once_per_day")) {
      throw conflict(`You already filed a pre-use inspection for ${asset?.asset_tag ?? "this machine"} today`);
    }
    throw error;
  }

  for (const item of template.items) {
    const answer = answersByKey.get(item.checklist_key) as AnswerInput;
    await db
      .prepare(
        `INSERT INTO inspection_answers (id, inspection_id, checklist_key, question, result, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(newId("ans"), inspectionId, item.checklist_key, item.question, answer.result, answer.notes?.trim() || null)
      .run();
  }

  for (const field of input.fields ?? []) {
    if (!field.key) continue;
    await db
      .prepare("INSERT INTO inspection_fields (inspection_id, field_key, label, value) VALUES (?, ?, ?, ?)")
      .bind(inspectionId, field.key, field.label, field.value?.trim() || null)
      .run();
  }

  if (asset && (meterReading != null || odometer != null)) {
    await recordMeterReading(db, {
      assetId: asset.id,
      readingType: meterReading != null ? "hours" : "miles",
      value: (meterReading ?? odometer) as number,
      source: "inspection",
      inspectionId,
      recordedBy: actor.employeeId,
      now,
    });
  }

  const defectIds: string[] = [];
  for (const failure of failures) {
    const defectId = newId("dfc");
    await db
      .prepare(
        `INSERT INTO defects (id, summary, detail, severity, status, source, inspection_id, checklist_key,
                              asset_id, home_id, job_id, reported_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'open', 'inspection', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        defectId,
        failure.item.question,
        failure.answer.notes?.trim() || null,
        failure.item.critical === 1 ? "critical" : "major",
        inspectionId,
        failure.item.checklist_key,
        input.assetId ?? null,
        input.homeId ?? null,
        input.jobId ?? home?.job_id ?? null,
        actor.employeeId,
        timestamp,
        timestamp,
      )
      .run();
    defectIds.push(defectId);
  }

  // A failed critical line means the machine does not leave the yard.
  const criticalFailure = failures.some((failure) => failure.item.critical === 1);
  let assetTakenOutOfService = false;
  if (asset && criticalFailure) {
    await db
      .prepare("UPDATE assets SET status = 'out_of_service', out_of_service_reason = ?, updated_at = ? WHERE id = ?")
      .bind(`Failed pre-use inspection ${todayIso(now)}: ${failures.find((f) => f.item.critical === 1)?.item.question}`, timestamp, asset.id)
      .run();
    assetTakenOutOfService = true;
  }

  if (home) {
    await advanceHomeMilestone(db, home.id, template.inspection_kind as InspectionKind, status, timestamp, now);
  }

  if (status === "defect_found") {
    const subject = asset ? asset.asset_tag : `home ${home?.serial_number}`;
    await notifyCategory(db, {
      category: "inspection_failed",
      severity: criticalFailure ? "urgent" : "warning",
      title: `${failures.length} defect${failures.length === 1 ? "" : "s"} on ${subject}`,
      body: `${actor.displayName} filed ${template.name} with ${failures.length} failed item${failures.length === 1 ? "" : "s"}.${
        assetTakenOutOfService ? " The machine is out of service." : ""
      }`,
      relatedType: "inspection",
      relatedId: inspectionId,
    });
  }

  return { inspectionId, status, defectIds, assetTakenOutOfService };
}

async function advanceHomeMilestone(
  db: Db,
  homeId: string,
  kind: InspectionKind,
  status: string,
  timestamp: string,
  now: Date,
): Promise<void> {
  const day = todayIso(now);
  if (kind === "delivery") {
    await db
      .prepare("UPDATE homes SET delivered_on = ifnull(delivered_on, ?), status = 'installed', updated_at = ? WHERE id = ?")
      .bind(day, timestamp, homeId)
      .run();
  } else if (kind === "setup") {
    await db
      .prepare(
        `UPDATE homes SET setup_completed_on = ifnull(setup_completed_on, ?),
                          status = CASE WHEN ? = 'passed' THEN 'inspection_pending' ELSE status END,
                          updated_at = ? WHERE id = ?`,
      )
      .bind(day, status, timestamp, homeId)
      .run();
  } else if (kind === "final_inspection" && status === "passed") {
    await db
      .prepare("UPDATE homes SET final_inspection_on = ?, status = 'complete', updated_at = ? WHERE id = ?")
      .bind(day, timestamp, homeId)
      .run();
  }
}

export interface MeterReadingInput {
  assetId: string;
  readingType: "hours" | "miles";
  value: number;
  source: "inspection" | "service" | "manual";
  inspectionId?: string | null;
  recordedBy: string;
  now?: Date;
}

export async function recordMeterReading(db: Db, input: MeterReadingInput): Promise<string> {
  const timestamp = nowIso(input.now ?? new Date());
  const id = newId("mtr");
  await db
    .prepare(
      `INSERT INTO asset_meter_readings (id, asset_id, reading_type, value, source, inspection_id, recorded_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.assetId, input.readingType, input.value, input.source, input.inspectionId ?? null, input.recordedBy, timestamp)
    .run();

  // Only ever move the running total forward; a typo caught later is still in
  // asset_meter_readings for reference.
  if (input.readingType === "hours") {
    await db
      .prepare("UPDATE assets SET hour_meter = max(ifnull(hour_meter, 0), ?), updated_at = ? WHERE id = ?")
      .bind(input.value, timestamp, input.assetId)
      .run();
  } else {
    await db
      .prepare("UPDATE assets SET odometer = max(ifnull(odometer, 0), ?), updated_at = ? WHERE id = ?")
      .bind(Math.round(input.value), timestamp, input.assetId)
      .run();
  }
  return id;
}

export interface InspectionDetail extends InspectionRow {
  template_name: string | null;
  performed_by_name: string;
  answers: { checklist_key: string; question: string; result: string; notes: string | null }[];
  fields: { field_key: string; label: string; value: string | null }[];
}

export async function getInspection(db: Db, inspectionId: string): Promise<InspectionDetail | null> {
  const inspection = await db
    .prepare(
      `SELECT i.*, t.name AS template_name, e.display_name AS performed_by_name
         FROM inspections i
         LEFT JOIN checklist_templates t ON t.id = i.template_id
         JOIN employees e ON e.id = i.performed_by
        WHERE i.id = ?`,
    )
    .bind(inspectionId)
    .first<InspectionDetail>();
  if (!inspection) return null;

  const answers = await db
    .prepare("SELECT checklist_key, question, result, notes FROM inspection_answers WHERE inspection_id = ? ORDER BY id")
    .bind(inspectionId)
    .all<{ checklist_key: string; question: string; result: string; notes: string | null }>();
  const fields = await db
    .prepare("SELECT field_key, label, value FROM inspection_fields WHERE inspection_id = ? ORDER BY field_key")
    .bind(inspectionId)
    .all<{ field_key: string; label: string; value: string | null }>();

  return { ...inspection, answers: answers.results, fields: fields.results };
}

export interface InspectionListRow {
  id: string;
  inspection_kind: string;
  status: string;
  performed_at: string;
  performed_by_name: string;
  template_name: string | null;
  meter_reading: number | null;
  odometer: number | null;
  defect_count: number;
}

export async function listInspections(
  db: Db,
  filter: { assetId?: string; homeId?: string; performedBy?: string; limit?: number },
): Promise<InspectionListRow[]> {
  const rows = await db
    .prepare(
      `SELECT i.id, i.inspection_kind, i.status, i.performed_at, i.meter_reading, i.odometer,
              e.display_name AS performed_by_name, t.name AS template_name,
              (SELECT count(*) FROM defects d WHERE d.inspection_id = i.id) AS defect_count
         FROM inspections i
         JOIN employees e ON e.id = i.performed_by
         LEFT JOIN checklist_templates t ON t.id = i.template_id
        WHERE (?1 IS NULL OR i.asset_id = ?1)
          AND (?2 IS NULL OR i.home_id = ?2)
          AND (?3 IS NULL OR i.performed_by = ?3)
        ORDER BY i.performed_at DESC, i.rowid DESC LIMIT ?4`,
    )
    .bind(filter.assetId ?? null, filter.homeId ?? null, filter.performedBy ?? null, filter.limit ?? 50)
    .all<InspectionListRow>();
  return rows.results;
}

/** Has this operator already cleared this machine today? */
export async function todaysInspection(
  db: Db,
  assetId: string,
  employeeId: string,
  now: Date = new Date(),
): Promise<InspectionRow | null> {
  return db
    .prepare(
      `SELECT * FROM inspections
        WHERE inspection_kind = 'daily_equipment' AND asset_id = ? AND performed_by = ?
          AND substr(performed_at, 1, 10) = ?`,
    )
    .bind(assetId, employeeId, todayIso(now))
    .first<InspectionRow>();
}
