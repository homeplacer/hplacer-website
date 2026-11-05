/** Shared-use history for fleet equipment. */
import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { recordMeterReading } from "./inspections.ts";

export interface EquipmentUseRecord {
  id: string;
  asset_id: string;
  employee_id: string;
  employee_name: string;
  job_id: string | null;
  job_title: string | null;
  used_at: string;
  hour_meter: number | null;
  odometer: number | null;
  notes: string | null;
}

export interface RecordEquipmentUseInput {
  assetId: string;
  employeeId: string;
  jobId?: string | null;
  hourMeter?: number | null;
  odometer?: number | null;
  notes?: string | null;
  now?: Date;
}

export async function listEquipmentUse(db: Db, assetId: string, limit = 20): Promise<EquipmentUseRecord[]> {
  const rows = await db
    .prepare(
      `SELECT u.*, e.display_name AS employee_name, j.title AS job_title
         FROM asset_usage_records u
         JOIN employees e ON e.id = u.employee_id
         LEFT JOIN jobs j ON j.id = u.job_id
        WHERE u.asset_id = ?
        ORDER BY u.used_at DESC, u.created_at DESC
        LIMIT ?`,
    )
    .bind(assetId, limit)
    .all<EquipmentUseRecord>();
  return rows.results;
}

export async function recordEquipmentUse(db: Db, input: RecordEquipmentUseInput): Promise<string> {
  const asset = await db
    .prepare("SELECT id, asset_tag, asset_type, status, hour_meter, odometer FROM assets WHERE id = ?")
    .bind(input.assetId)
    .first<{ id: string; asset_tag: string; asset_type: string; status: string; hour_meter: number | null; odometer: number | null }>();
  if (!asset) throw notFound("Equipment not found");
  if (asset.status === "retired") throw badRequest("Retired equipment cannot be logged as used");

  if (input.jobId) {
    const job = await db.prepare("SELECT id FROM jobs WHERE id = ? AND status IN ('planning', 'active')").bind(input.jobId).first<{ id: string }>();
    if (!job) throw badRequest("Choose an active job site or leave the job blank");
  }

  const hourMeter = input.hourMeter ?? null;
  const odometer = input.odometer ?? null;
  if (hourMeter != null && (!Number.isFinite(hourMeter) || hourMeter < 0)) throw badRequest("Enter a valid hour reading");
  if (odometer != null && (!Number.isFinite(odometer) || odometer < 0)) throw badRequest("Enter a valid mileage reading");
  if (hourMeter != null && odometer != null) throw badRequest("Enter hours or miles, not both");
  if (hourMeter != null && asset.hour_meter != null && hourMeter + 0.001 < asset.hour_meter) {
    throw badRequest(`Hour meter reads lower than the last recorded ${asset.hour_meter}. Re-check the meter.`);
  }
  if (odometer != null && asset.odometer != null && odometer < asset.odometer) {
    throw badRequest(`Odometer reads lower than the last recorded ${asset.odometer}. Re-check the dash.`);
  }

  const timestamp = nowIso(input.now ?? new Date());
  const id = newId("use");
  await db
    .prepare(
      `INSERT INTO asset_usage_records (id, asset_id, employee_id, job_id, used_at, hour_meter, odometer, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.assetId, input.employeeId, input.jobId ?? null, timestamp, hourMeter, odometer, input.notes?.trim() || null, timestamp)
    .run();

  if (hourMeter != null) {
    await recordMeterReading(db, { assetId: input.assetId, readingType: "hours", value: hourMeter, source: "manual", recordedBy: input.employeeId, now: input.now });
  } else if (odometer != null) {
    await recordMeterReading(db, { assetId: input.assetId, readingType: "miles", value: odometer, source: "manual", recordedBy: input.employeeId, now: input.now });
  }
  return id;
}
