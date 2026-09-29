/** Current job-site and home assignments for shared fleet equipment. */
import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, DbPreparedStatement } from "../platform/types.ts";
import { assetDisplayName, type AssetType } from "./assets.ts";

export type EquipmentLocationTarget = { jobId: string; homeId?: never } | { homeId: string; jobId?: never };

export interface EquipmentAtLocation {
  id: string;
  asset_tag: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  model_year: number | null;
  status: string;
  assigned_at: string;
}

export interface EquipmentLocationChoice extends Omit<EquipmentAtLocation, "assigned_at"> {
  assigned_here: number;
  other_location: string | null;
}

export function equipmentLocationName(asset: Pick<EquipmentAtLocation, "manufacturer" | "model" | "model_year" | "asset_type" | "asset_tag">): string {
  return assetDisplayName({ ...asset, asset_type: asset.asset_type as AssetType });
}

export async function listEquipmentAtLocation(db: Db, target: EquipmentLocationTarget): Promise<EquipmentAtLocation[]> {
  const where = target.jobId ? "s.job_id = ?" : "s.home_id = ?";
  const targetId = target.jobId ?? target.homeId!;
  const rows = await db.prepare(
    `SELECT a.id, a.asset_tag, a.asset_type, a.manufacturer, a.model, a.model_year, a.status, s.assigned_at
       FROM asset_site_assignments s JOIN assets a ON a.id = s.asset_id
      WHERE ${where} AND s.released_at IS NULL
      ORDER BY a.asset_type, a.manufacturer, a.model, a.asset_tag`,
  ).bind(targetId).all<EquipmentAtLocation>();
  return rows.results;
}

export async function listEquipmentLocationChoices(db: Db, target: EquipmentLocationTarget): Promise<EquipmentLocationChoice[]> {
  const sameLocation = target.jobId ? "current.job_id = ?" : "current.home_id = ?";
  const targetId = target.jobId ?? target.homeId!;
  const rows = await db.prepare(
    `SELECT a.id, a.asset_tag, a.asset_type, a.manufacturer, a.model, a.model_year, a.status,
            CASE WHEN ${sameLocation} THEN 1 ELSE 0 END AS assigned_here,
            CASE WHEN current.asset_id IS NULL OR ${sameLocation} THEN NULL
                 WHEN current.job_id IS NOT NULL THEN coalesce(j.title, 'another job site')
                 ELSE coalesce(h.site_address, h.monday_item_name, 'another home') END AS other_location
       FROM assets a
       LEFT JOIN asset_site_assignments current ON current.asset_id = a.id AND current.released_at IS NULL
       LEFT JOIN jobs j ON j.id = current.job_id
       LEFT JOIN homes h ON h.id = current.home_id
      WHERE a.status <> 'retired'
      ORDER BY assigned_here DESC, a.asset_type, a.manufacturer, a.model, a.asset_tag`,
  ).bind(targetId, targetId).all<EquipmentLocationChoice>();
  return rows.results;
}

/** Save all selected machines for a place. A selected machine moves from its previous place. */
export async function assignEquipmentToLocation(
  db: Db,
  target: EquipmentLocationTarget,
  employeeId: string,
  requestedAssetIds: string[],
): Promise<void> {
  const hasJob = Boolean(target.jobId);
  const hasHome = Boolean(target.homeId);
  if (hasJob === hasHome) throw badRequest("Choose one job site or one home");

  const targetId = target.jobId ?? target.homeId!;
  const targetTable = target.jobId ? "jobs" : "homes";
  const targetColumn = target.jobId ? "job_id" : "home_id";
  const exists = await db.prepare(`SELECT id FROM ${targetTable} WHERE id = ?`).bind(targetId).first<{ id: string }>();
  if (!exists) throw notFound(target.jobId ? "Job site not found" : "Home not found");

  const assetIds = [...new Set(requestedAssetIds.map((id) => id.trim()).filter(Boolean))];
  if (assetIds.length > 0) {
    const placeholders = assetIds.map(() => "?").join(", ");
    const assets = await db.prepare(`SELECT id, status FROM assets WHERE id IN (${placeholders})`).bind(...assetIds)
      .all<{ id: string; status: string }>();
    const byId = new Map(assets.results.map((asset) => [asset.id, asset]));
    for (const id of assetIds) {
      const asset = byId.get(id);
      if (!asset) throw notFound("One of the selected pieces of equipment was not found");
      if (asset.status === "retired") throw badRequest("Retired equipment cannot be assigned to a site");
    }
  }

  const currentHere = await db.prepare(
    `SELECT asset_id FROM asset_site_assignments WHERE ${targetColumn} = ? AND released_at IS NULL`,
  ).bind(targetId).all<{ asset_id: string }>();
  const currentIds = new Set(currentHere.results.map((row) => row.asset_id));
  const selectedIds = new Set(assetIds);
  const timestamp = nowIso();
  const statements: DbPreparedStatement[] = [];

  for (const row of currentHere.results) {
    if (!selectedIds.has(row.asset_id)) {
      statements.push(db.prepare(
        "UPDATE asset_site_assignments SET released_at = ? WHERE asset_id = ? AND released_at IS NULL",
      ).bind(timestamp, row.asset_id));
    }
  }
  for (const assetId of assetIds) {
    if (!currentIds.has(assetId)) {
      statements.push(db.prepare(
        "UPDATE asset_site_assignments SET released_at = ? WHERE asset_id = ? AND released_at IS NULL",
      ).bind(timestamp, assetId));
      statements.push(db.prepare(
        `INSERT INTO asset_site_assignments (id, asset_id, ${targetColumn}, assigned_by, assigned_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(newId("siteeq"), assetId, targetId, employeeId, timestamp));
    }
  }
  if (statements.length) await db.batch(statements);
}
