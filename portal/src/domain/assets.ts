/**
 * Equipment: excavators, skid steers, bulldozers, trailers, dump trucks, and
 * pickups. Keyed by asset tag — the sticker on the machine — with the serial
 * number or VIN as the canonical key used for Monday linking.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { canonicalKey, newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { recordMeterReading } from "./inspections.ts";
import { notifyCategory } from "./notifications.ts";

export const ASSET_TYPES = [
  "excavator",
  "skid_steer",
  "bulldozer",
  "trailer",
  "dump_truck",
  "pickup_truck",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  excavator: "Excavator",
  skid_steer: "Skid steer",
  bulldozer: "Bulldozer",
  trailer: "Trailer",
  dump_truck: "Dump truck",
  pickup_truck: "Pickup",
  other: "Other",
};

const ASSET_STATUSES = ["available", "in_use", "out_of_service", "retired"];

export interface AssetRow {
  id: string;
  asset_tag: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  model_year: number | null;
  serial_number: string | null;
  vin: string | null;
  plate_number: string | null;
  hour_meter: number | null;
  odometer: number | null;
  status: string;
  home_base: string | null;
  assigned_to: string | null;
  out_of_service_reason: string | null;
  monday_item_id: string | null;
}

export interface AssetSummary extends AssetRow {
  assigned_to_name: string | null;
  open_defect_count: number;
  last_inspected_at: string | null;
  verification_status: AssetVerificationStatus | null;
  source_notes: string | null;
}

export const ASSET_VERIFICATION_STATUSES = ["verified", "needs_serial", "needs_model", "needs_owner", "needs_vin", "unassigned"] as const;
export type AssetVerificationStatus = (typeof ASSET_VERIFICATION_STATUSES)[number];

export interface AssetSourceMetadata {
  asset_id: string;
  source_file: string;
  source_reference: string;
  source_notes: string | null;
  verification_status: AssetVerificationStatus;
  imported_at: string;
  updated_at: string;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
}

export async function listAssets(db: Db, options: { type?: string; status?: string; search?: string } = {}): Promise<AssetSummary[]> {
  const rows = await db
    .prepare(
      `SELECT a.*, e.display_name AS assigned_to_name, asm.verification_status, asm.source_notes,
              (SELECT count(*) FROM defects d WHERE d.asset_id = a.id AND d.status = 'open') AS open_defect_count,
              (SELECT max(performed_at) FROM inspections i WHERE i.asset_id = a.id) AS last_inspected_at
         FROM assets a
         LEFT JOIN employees e ON e.id = a.assigned_to
         LEFT JOIN asset_source_metadata asm ON asm.asset_id = a.id
        WHERE (?1 IS NULL OR a.asset_type = ?1)
          AND (?2 IS NULL OR a.status = ?2)
          AND (?3 IS NULL OR a.asset_tag LIKE ?3 OR ifnull(a.serial_number, '') LIKE ?3
               OR ifnull(a.vin, '') LIKE ?3 OR ifnull(a.model, '') LIKE ?3)
        ORDER BY a.asset_type, a.asset_tag`,
    )
    .bind(options.type ?? null, options.status ?? null, options.search ? `%${options.search.toUpperCase()}%` : null)
    .all<AssetSummary>();
  return rows.results;
}

export async function assetSourceMetadata(db: Db, assetId: string): Promise<AssetSourceMetadata | null> {
  return db
    .prepare(
      `SELECT asm.*, e.display_name AS resolved_by_name
         FROM asset_source_metadata asm
         LEFT JOIN employees e ON e.id = asm.resolved_by
        WHERE asm.asset_id = ?`,
    )
    .bind(assetId)
    .first<AssetSourceMetadata>();
}

export interface ResolveAssetVerificationInput {
  assetId: string;
  serialNumber?: string | null;
  vin?: string | null;
  model?: string | null;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  resolvedBy: string;
}

/**
 * Clear a fleet-register verification flag only after recording what was
 * checked. The original source note remains immutable for later audit.
 */
export async function resolveAssetVerification(db: Db, input: ResolveAssetVerificationInput): Promise<void> {
  const metadata = await assetSourceMetadata(db, input.assetId);
  if (!metadata) throw notFound("This equipment record has no imported-source verification flag");
  if (metadata.verification_status === "verified") throw badRequest("This equipment record is already verified");

  const serial = input.serialNumber?.trim() ? canonicalKey(input.serialNumber) : null;
  const vin = input.vin?.trim() ? canonicalKey(input.vin) : null;
  const model = input.model?.trim() || null;
  const notes = input.resolutionNotes?.trim() || null;
  if (metadata.verification_status === "needs_serial" && !serial) throw badRequest("Enter the confirmed serial number before clearing this flag");
  if (metadata.verification_status === "needs_vin" && !vin) throw badRequest("Enter the confirmed VIN before clearing this flag");
  if (vin && vin.length !== 17) throw badRequest("A VIN is 17 characters");
  if (!notes) throw badRequest("Record how this source question was resolved");

  const asset = await requireAsset(db, input.assetId);
  const duplicate = await db
    .prepare(
      `SELECT asset_tag FROM assets
        WHERE id <> ?1
          AND ((?2 IS NOT NULL AND serial_number = ?2) OR (?3 IS NOT NULL AND vin = ?3))`,
    )
    .bind(asset.id, serial, vin)
    .first<{ asset_tag: string }>();
  if (duplicate) throw conflict(`${duplicate.asset_tag} already uses that serial number or VIN`);

  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE assets
          SET serial_number = coalesce(?1, serial_number),
              vin = coalesce(?2, vin),
              model = coalesce(?3, model),
              assigned_to = ?4,
              updated_at = ?5
        WHERE id = ?6`,
    )
    .bind(serial, vin, model, input.assignedTo, timestamp, asset.id)
    .run();
  await db
    .prepare(
      `UPDATE asset_source_metadata
          SET verification_status = 'verified', resolution_notes = ?1,
              resolved_by = ?2, resolved_at = ?3, updated_at = ?3
        WHERE asset_id = ?4`,
    )
    .bind(notes, input.resolvedBy, timestamp, asset.id)
    .run();
}

export async function getAsset(db: Db, idOrTag: string): Promise<AssetRow | null> {
  return db
    .prepare("SELECT * FROM assets WHERE id = ?1 OR asset_tag = ?1")
    .bind(idOrTag)
    .first<AssetRow>();
}

export async function requireAsset(db: Db, idOrTag: string): Promise<AssetRow> {
  const asset = await getAsset(db, idOrTag);
  if (!asset) throw notFound("Equipment not found");
  return asset;
}

/** The Monday-facing key for a machine: VIN for road equipment, serial otherwise. */
export function assetCanonicalKey(asset: Pick<AssetRow, "vin" | "serial_number" | "asset_tag">): string {
  return canonicalKey(asset.vin ?? asset.serial_number ?? asset.asset_tag);
}

export interface CreateAssetInput {
  assetTag: string;
  assetType: AssetType;
  manufacturer?: string | null;
  model?: string | null;
  modelYear?: number | null;
  serialNumber?: string | null;
  vin?: string | null;
  plateNumber?: string | null;
  hourMeter?: number | null;
  odometer?: number | null;
  homeBase?: string | null;
}

export async function createAsset(db: Db, input: CreateAssetInput): Promise<string> {
  const tag = input.assetTag.trim().toUpperCase();
  if (!tag) throw badRequest("Asset tag is required");
  if (!ASSET_TYPES.includes(input.assetType)) throw badRequest(`Unknown equipment type "${input.assetType}"`);

  const serial = input.serialNumber ? canonicalKey(input.serialNumber) : null;
  const vin = input.vin ? canonicalKey(input.vin) : null;
  // Every machine needs one identifier that survives a re-tag; that identifier
  // is also what the Monday sync keys on.
  if (!serial && !vin) throw badRequest("Record a serial number or a VIN — the asset tag alone is not a durable key");
  if (vin && vin.length !== 17) throw badRequest("A VIN is 17 characters");

  const clash = await db
    .prepare("SELECT asset_tag FROM assets WHERE asset_tag = ?1 OR (?2 IS NOT NULL AND serial_number = ?2) OR (?3 IS NOT NULL AND vin = ?3)")
    .bind(tag, serial, vin)
    .first<{ asset_tag: string }>();
  if (clash) throw conflict(`${clash.asset_tag} already uses that tag, serial number, or VIN`);

  const id = newId("ast");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO assets (id, asset_tag, asset_type, manufacturer, model, model_year, serial_number, vin,
                           plate_number, hour_meter, odometer, status, home_base, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`,
    )
    .bind(
      id,
      tag,
      input.assetType,
      input.manufacturer ?? null,
      input.model ?? null,
      input.modelYear ?? null,
      serial,
      vin,
      input.plateNumber ?? null,
      input.hourMeter ?? null,
      input.odometer ?? null,
      input.homeBase ?? null,
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

export async function setAssetStatus(db: Db, assetId: string, status: string, reason: string | null): Promise<void> {
  if (!ASSET_STATUSES.includes(status)) throw badRequest(`Unknown status "${status}"`);
  if (status === "out_of_service" && !reason?.trim()) throw badRequest("Say why the machine is out of service");
  const result = await db
    .prepare("UPDATE assets SET status = ?, out_of_service_reason = ?, updated_at = ? WHERE id = ?")
    .bind(status, status === "out_of_service" ? (reason as string).trim() : null, nowIso(), assetId)
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Equipment not found");
}

export async function assignAsset(db: Db, assetId: string, employeeId: string | null): Promise<void> {
  await db
    .prepare("UPDATE assets SET assigned_to = ?, updated_at = ? WHERE id = ?")
    .bind(employeeId, nowIso(), assetId)
    .run();
}

// ---------------------------------------------------------------------------
// Service tracking
// ---------------------------------------------------------------------------

export interface ServiceScheduleRow {
  id: string;
  asset_id: string;
  service_key: string;
  description: string;
  interval_hours: number | null;
  interval_miles: number | null;
  interval_days: number | null;
  last_service_at: string | null;
  last_service_hours: number | null;
  last_service_miles: number | null;
  active: number;
}

export interface ServiceDue extends ServiceScheduleRow {
  /** Negative once the interval has been passed. */
  hours_remaining: number | null;
  miles_remaining: number | null;
  days_remaining: number | null;
  due: boolean;
  overdue: boolean;
}

export function evaluateSchedule(
  schedule: ServiceScheduleRow,
  asset: Pick<AssetRow, "hour_meter" | "odometer">,
  now: Date = new Date(),
): ServiceDue {
  const hoursRemaining =
    schedule.interval_hours != null && asset.hour_meter != null
      ? (schedule.last_service_hours ?? 0) + schedule.interval_hours - asset.hour_meter
      : null;
  const milesRemaining =
    schedule.interval_miles != null && asset.odometer != null
      ? (schedule.last_service_miles ?? 0) + schedule.interval_miles - asset.odometer
      : null;

  let daysRemaining: number | null = null;
  if (schedule.interval_days != null) {
    const last = schedule.last_service_at ? Date.parse(`${schedule.last_service_at.replace(" ", "T")}Z`) : null;
    if (last != null && !Number.isNaN(last)) {
      const elapsedDays = (now.getTime() - last) / 86_400_000;
      daysRemaining = schedule.interval_days - elapsedDays;
    }
  }

  const values = [hoursRemaining, milesRemaining, daysRemaining].filter((value): value is number => value != null);
  const overdue = values.some((value) => value < 0);
  // "Due soon" thresholds: 10 % of a meter interval, or a week of calendar time.
  const due =
    overdue ||
    (hoursRemaining != null && schedule.interval_hours != null && hoursRemaining <= schedule.interval_hours * 0.1) ||
    (milesRemaining != null && schedule.interval_miles != null && milesRemaining <= schedule.interval_miles * 0.1) ||
    (daysRemaining != null && daysRemaining <= 7);

  return { ...schedule, hours_remaining: hoursRemaining, miles_remaining: milesRemaining, days_remaining: daysRemaining, due, overdue };
}

export async function serviceSchedulesFor(db: Db, asset: AssetRow, now: Date = new Date()): Promise<ServiceDue[]> {
  const rows = await db
    .prepare("SELECT * FROM asset_service_schedules WHERE asset_id = ? AND active = 1 ORDER BY service_key")
    .bind(asset.id)
    .all<ServiceScheduleRow>();
  return rows.results.map((schedule) => evaluateSchedule(schedule, asset, now));
}

export interface FleetServiceDue extends ServiceDue {
  asset_tag: string;
  asset_type: string;
}

export async function fleetServiceDue(db: Db, now: Date = new Date()): Promise<FleetServiceDue[]> {
  const rows = await db
    .prepare(
      `SELECT s.*, a.asset_tag, a.asset_type, a.hour_meter, a.odometer
         FROM asset_service_schedules s
         JOIN assets a ON a.id = s.asset_id
        WHERE s.active = 1 AND a.status <> 'retired'`,
    )
    .all<ServiceScheduleRow & { asset_tag: string; asset_type: string; hour_meter: number | null; odometer: number | null }>();

  return rows.results
    .map((row) => ({ ...evaluateSchedule(row, row, now), asset_tag: row.asset_tag, asset_type: row.asset_type }))
    .filter((row) => row.due)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.asset_tag.localeCompare(b.asset_tag));
}

export interface CreateScheduleInput {
  assetId: string;
  serviceKey: string;
  description: string;
  intervalHours?: number | null;
  intervalMiles?: number | null;
  intervalDays?: number | null;
  lastServiceAt?: string | null;
  lastServiceHours?: number | null;
  lastServiceMiles?: number | null;
}

export async function createServiceSchedule(db: Db, input: CreateScheduleInput): Promise<string> {
  if (!input.serviceKey.trim()) throw badRequest("Service key is required");
  if (input.intervalHours == null && input.intervalMiles == null && input.intervalDays == null) {
    throw badRequest("Set at least one interval: hours, miles, or days");
  }
  const id = newId("svs");
  await db
    .prepare(
      `INSERT INTO asset_service_schedules (id, asset_id, service_key, description, interval_hours, interval_miles,
                                            interval_days, last_service_at, last_service_hours, last_service_miles, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      id,
      input.assetId,
      input.serviceKey.trim(),
      input.description.trim(),
      input.intervalHours ?? null,
      input.intervalMiles ?? null,
      input.intervalDays ?? null,
      input.lastServiceAt ?? null,
      input.lastServiceHours ?? null,
      input.lastServiceMiles ?? null,
    )
    .run();
  return id;
}

export interface RecordServiceInput {
  assetId: string;
  scheduleId?: string | null;
  serviceType: "preventive" | "repair" | "inspection" | "other";
  description: string;
  vendor?: string | null;
  hourMeter?: number | null;
  odometer?: number | null;
  costCents?: number | null;
  repairTicketId?: string | null;
  performedBy: string;
  now?: Date;
}

export async function recordService(db: Db, input: RecordServiceInput): Promise<string> {
  if (!input.description.trim()) throw badRequest("Describe the service performed");
  const asset = await db.prepare("SELECT * FROM assets WHERE id = ?").bind(input.assetId).first<AssetRow>();
  if (!asset) throw notFound("Equipment not found");

  const now = input.now ?? new Date();
  const timestamp = nowIso(now);
  const id = newId("svr");
  await db
    .prepare(
      `INSERT INTO asset_service_records (id, asset_id, schedule_id, service_type, description, performed_at,
                                          performed_by, vendor, hour_meter, odometer, cost_cents, repair_ticket_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.assetId,
      input.scheduleId ?? null,
      input.serviceType,
      input.description.trim(),
      timestamp,
      input.performedBy,
      input.vendor ?? null,
      input.hourMeter ?? null,
      input.odometer ?? null,
      input.costCents ?? null,
      input.repairTicketId ?? null,
      timestamp,
    )
    .run();

  if (input.hourMeter != null) {
    await recordMeterReading(db, {
      assetId: input.assetId,
      readingType: "hours",
      value: input.hourMeter,
      source: "service",
      recordedBy: input.performedBy,
      now,
    });
  }
  if (input.odometer != null) {
    await recordMeterReading(db, {
      assetId: input.assetId,
      readingType: "miles",
      value: input.odometer,
      source: "service",
      recordedBy: input.performedBy,
      now,
    });
  }

  if (input.scheduleId) {
    await db
      .prepare(
        `UPDATE asset_service_schedules
            SET last_service_at = ?, last_service_hours = ifnull(?, last_service_hours), last_service_miles = ifnull(?, last_service_miles)
          WHERE id = ? AND asset_id = ?`,
      )
      .bind(timestamp, input.hourMeter ?? null, input.odometer ?? null, input.scheduleId, input.assetId)
      .run();
  }
  return id;
}

export interface ServiceRecordRow {
  id: string;
  service_type: string;
  description: string;
  performed_at: string;
  performed_by_name: string | null;
  vendor: string | null;
  hour_meter: number | null;
  odometer: number | null;
  cost_cents: number | null;
  repair_ticket_id: string | null;
}

export async function listServiceRecords(db: Db, assetId: string, limit = 50): Promise<ServiceRecordRow[]> {
  const rows = await db
    .prepare(
      `SELECT r.id, r.service_type, r.description, r.performed_at, r.vendor, r.hour_meter, r.odometer,
              r.cost_cents, r.repair_ticket_id, e.display_name AS performed_by_name
         FROM asset_service_records r
         LEFT JOIN employees e ON e.id = r.performed_by
        WHERE r.asset_id = ? ORDER BY r.performed_at DESC LIMIT ?`,
    )
    .bind(assetId, limit)
    .all<ServiceRecordRow>();
  return rows.results;
}

/** Daily sweep: tell the supervisors which machines are coming due. */
export async function notifyServiceDue(db: Db, now: Date = new Date()): Promise<number> {
  const due = await fleetServiceDue(db, now);
  let sent = 0;
  for (const item of due) {
    sent += await notifyCategory(db, {
      category: "service_due",
      severity: item.overdue ? "warning" : "info",
      title: `${item.asset_tag}: ${item.description} ${item.overdue ? "overdue" : "due soon"}`,
      body: describeServiceDue(item),
      relatedType: "asset",
      relatedId: item.asset_id,
      dedupeKey: `service_due:${item.id}:${item.overdue ? "overdue" : "soon"}`,
    });
  }
  return sent;
}

export function describeServiceDue(item: ServiceDue): string {
  const parts: string[] = [];
  if (item.hours_remaining != null) parts.push(`${Math.abs(Math.round(item.hours_remaining))} h ${item.hours_remaining < 0 ? "past" : "left"}`);
  if (item.miles_remaining != null) parts.push(`${Math.abs(Math.round(item.miles_remaining))} mi ${item.miles_remaining < 0 ? "past" : "left"}`);
  if (item.days_remaining != null) parts.push(`${Math.abs(Math.round(item.days_remaining))} days ${item.days_remaining < 0 ? "past" : "left"}`);
  return parts.join(" · ") || "Interval reached";
}
