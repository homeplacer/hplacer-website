/**
 * Shop inventory: parts with a preferred vendor link and cost, stock levels
 * driven by signed movements, reorder points, low-stock alerts, and the
 * material requests that come off a repair ticket or an inspection.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import type { Actor } from "../auth/authz.ts";
import { normalizeUrl } from "./jobs.ts";
import { notify, notifyCategory } from "./notifications.ts";

export const MOVEMENT_TYPES = ["received", "used", "adjustment", "returned"] as const;
export const REQUEST_STATUSES = ["requested", "approved", "ordered", "received", "cancelled"] as const;

export interface PartRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  preferred_vendor: string | null;
  product_url: string | null;
  preferred_unit_cost_cents: number | null;
  storage_location: string | null;
  low_stock_notified_at: string | null;
  active: number;
}

export interface PartSummary extends PartRow {
  low_stock: number;
  open_request_count: number;
}

export async function listParts(db: Db, options: { search?: string; lowOnly?: boolean } = {}): Promise<PartSummary[]> {
  const rows = await db
    .prepare(
      `SELECT p.*, (p.quantity_on_hand <= p.reorder_point) AS low_stock,
              (SELECT count(*) FROM material_requests m
                WHERE m.part_id = p.id AND m.status IN ('requested', 'approved', 'ordered')) AS open_request_count
         FROM parts p
        WHERE p.active = 1
          AND (?1 IS NULL OR p.sku LIKE ?1 OR p.name LIKE ?1 OR ifnull(p.preferred_vendor, '') LIKE ?1)
          AND (?2 = 0 OR p.quantity_on_hand <= p.reorder_point)
        ORDER BY (p.quantity_on_hand <= p.reorder_point) DESC, p.name`,
    )
    .bind(options.search ? `%${options.search}%` : null, options.lowOnly ? 1 : 0)
    .all<PartSummary>();
  return rows.results;
}

export async function getPart(db: Db, idOrSku: string): Promise<PartRow | null> {
  return db.prepare("SELECT * FROM parts WHERE id = ?1 OR sku = ?1").bind(idOrSku).first<PartRow>();
}

export async function requirePart(db: Db, idOrSku: string): Promise<PartRow> {
  const part = await getPart(db, idOrSku);
  if (!part) throw notFound("Part not found");
  return part;
}

export interface CreatePartInput {
  sku: string;
  name: string;
  description?: string | null;
  unit?: string;
  reorderPoint?: number;
  reorderQuantity?: number;
  preferredVendor?: string | null;
  productUrl?: string | null;
  preferredUnitCostCents?: number | null;
  storageLocation?: string | null;
  openingQuantity?: number;
  recordedBy?: string;
}

export async function createPart(db: Db, input: CreatePartInput): Promise<string> {
  const sku = input.sku.trim().toUpperCase();
  if (!sku) throw badRequest("SKU is required");
  if (!input.name.trim()) throw badRequest("Part name is required");
  if ((input.reorderPoint ?? 0) < 0) throw badRequest("Reorder point cannot be negative");

  const existing = await db.prepare("SELECT id FROM parts WHERE sku = ?").bind(sku).first<{ id: string }>();
  if (existing) throw conflict(`SKU ${sku} already exists`);

  const id = newId("prt");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO parts (id, sku, name, description, unit, quantity_on_hand, reorder_point, reorder_quantity,
                          preferred_vendor, product_url, preferred_unit_cost_cents, storage_location, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      id,
      sku,
      input.name.trim(),
      input.description?.trim() || null,
      input.unit?.trim() || "each",
      input.reorderPoint ?? 0,
      input.reorderQuantity ?? 0,
      input.preferredVendor?.trim() || null,
      normalizeUrl(input.productUrl),
      input.preferredUnitCostCents ?? null,
      input.storageLocation?.trim() || null,
      timestamp,
      timestamp,
    )
    .run();

  // Opening balance goes through a movement so the ledger is complete from row one.
  if (input.openingQuantity && input.openingQuantity !== 0 && input.recordedBy) {
    await recordMovement(db, {
      partId: id,
      movementType: "received",
      quantity: input.openingQuantity,
      recordedBy: input.recordedBy,
      notes: "Opening balance",
    });
  }
  return id;
}

export interface UpdatePartInput {
  partId: string;
  name?: string;
  reorderPoint?: number;
  reorderQuantity?: number;
  preferredVendor?: string | null;
  productUrl?: string | null;
  preferredUnitCostCents?: number | null;
  storageLocation?: string | null;
}

export async function updatePart(db: Db, input: UpdatePartInput): Promise<void> {
  const part = await requirePart(db, input.partId);
  await db
    .prepare(
      `UPDATE parts SET name = ?, reorder_point = ?, reorder_quantity = ?, preferred_vendor = ?, product_url = ?,
                        preferred_unit_cost_cents = ?, storage_location = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      input.name?.trim() || part.name,
      input.reorderPoint ?? part.reorder_point,
      input.reorderQuantity ?? part.reorder_quantity,
      input.preferredVendor === undefined ? part.preferred_vendor : input.preferredVendor?.trim() || null,
      input.productUrl === undefined ? part.product_url : normalizeUrl(input.productUrl),
      input.preferredUnitCostCents === undefined ? part.preferred_unit_cost_cents : input.preferredUnitCostCents,
      input.storageLocation === undefined ? part.storage_location : input.storageLocation?.trim() || null,
      nowIso(),
      part.id,
    )
    .run();
}

export interface MovementInput {
  partId: string;
  movementType: (typeof MOVEMENT_TYPES)[number];
  /** Signed: positive adds to stock, negative removes it. */
  quantity: number;
  repairTicketId?: string | null;
  recordedBy: string;
  notes?: string | null;
}

/**
 * The only way stock changes. `parts.quantity_on_hand` is maintained by the
 * trigger in migration 0002, so the ledger and the balance cannot drift.
 */
export async function recordMovement(db: Db, input: MovementInput): Promise<string> {
  if (!Number.isFinite(input.quantity) || input.quantity === 0) throw badRequest("Enter a non-zero quantity");
  if (!(MOVEMENT_TYPES as readonly string[]).includes(input.movementType)) {
    throw badRequest(`Unknown movement "${input.movementType}"`);
  }
  const part = await requirePart(db, input.partId);

  // Sign conventions are enforced here so a typo cannot inflate the shelf.
  const signed =
    input.movementType === "used"
      ? -Math.abs(input.quantity)
      : input.movementType === "adjustment"
        ? input.quantity
        : Math.abs(input.quantity);

  if (part.quantity_on_hand + signed < 0) {
    throw badRequest(`Only ${part.quantity_on_hand} ${part.unit} of ${part.sku} on hand`);
  }

  const id = newId("mov");
  await db
    .prepare(
      `INSERT INTO inventory_movements (id, part_id, movement_type, quantity, repair_ticket_id, recorded_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, part.id, input.movementType, signed, input.repairTicketId ?? null, input.recordedBy, input.notes?.trim() || null, nowIso())
    .run();

  await checkLowStock(db, part.id);
  return id;
}

export async function consumeStockForRepair(
  db: Db,
  actor: Actor,
  input: { partId: string; quantity: number; repairTicketId: string },
): Promise<string> {
  return recordMovement(db, {
    partId: input.partId,
    movementType: "used",
    quantity: input.quantity,
    repairTicketId: input.repairTicketId,
    recordedBy: actor.employeeId,
    notes: "Consumed on repair ticket",
  });
}

/**
 * Fires a low-stock alert when a part crosses its reorder point, and clears the
 * marker once stock is back up so the next dip alerts again.
 */
export async function checkLowStock(db: Db, partId: string): Promise<boolean> {
  const part = await db
    .prepare("SELECT id, sku, name, unit, quantity_on_hand, reorder_point, reorder_quantity, preferred_vendor, product_url, low_stock_notified_at FROM parts WHERE id = ?")
    .bind(partId)
    .first<PartRow>();
  if (!part) return false;

  if (part.quantity_on_hand > part.reorder_point) {
    if (part.low_stock_notified_at) {
      await db.prepare("UPDATE parts SET low_stock_notified_at = NULL WHERE id = ?").bind(part.id).run();
      await db.prepare("DELETE FROM notifications WHERE dedupe_key = ?").bind(`low_stock:${part.id}`).run();
    }
    return false;
  }
  if (part.low_stock_notified_at) return false;

  const vendor = part.preferred_vendor ? ` Preferred vendor: ${part.preferred_vendor}.` : "";
  const suggestion = part.reorder_quantity > 0 ? ` Suggested order: ${part.reorder_quantity} ${part.unit}.` : "";
  await notifyCategory(db, {
    category: "inventory_low",
    severity: "warning",
    title: `Low stock: ${part.sku} — ${part.name}`,
    body: `${part.quantity_on_hand} ${part.unit} on hand against a reorder point of ${part.reorder_point}.${suggestion}${vendor}`,
    relatedType: "part",
    relatedId: part.id,
    dedupeKey: `low_stock:${part.id}`,
  });
  await db.prepare("UPDATE parts SET low_stock_notified_at = ? WHERE id = ?").bind(nowIso(), part.id).run();
  return true;
}

/** Daily sweep, for parts that were already low before the alerting existed. */
export async function sweepLowStock(db: Db): Promise<number> {
  const rows = await db
    .prepare("SELECT id FROM parts WHERE active = 1 AND quantity_on_hand <= reorder_point AND low_stock_notified_at IS NULL")
    .all<{ id: string }>();
  let alerted = 0;
  for (const row of rows.results) if (await checkLowStock(db, row.id)) alerted += 1;
  return alerted;
}

export interface MovementRow {
  id: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  recorded_by_name: string;
  ticket_number: string | null;
}

export async function listMovements(db: Db, partId: string, limit = 50): Promise<MovementRow[]> {
  const rows = await db
    .prepare(
      `SELECT m.id, m.movement_type, m.quantity, m.notes, m.created_at,
              e.display_name AS recorded_by_name, r.ticket_number
         FROM inventory_movements m
         JOIN employees e ON e.id = m.recorded_by
         LEFT JOIN repair_tickets r ON r.id = m.repair_ticket_id
        WHERE m.part_id = ? ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`,
    )
    .bind(partId, limit)
    .all<MovementRow>();
  return rows.results;
}

// ---------------------------------------------------------------------------
// Material requests
// ---------------------------------------------------------------------------

export interface MaterialRequestRow {
  id: string;
  status: string;
  part_id: string | null;
  sku: string | null;
  repair_ticket_id: string | null;
  ticket_number: string | null;
  inspection_id: string | null;
  requested_by: string;
  requested_by_name: string;
  requested_quantity: number;
  description: string;
  supplier_name: string | null;
  supplier_url: string | null;
  needed_by: string | null;
  estimated_unit_cost_cents: number | null;
  created_at: string;
}

export interface CreateRequestInput {
  partId?: string | null;
  repairTicketId?: string | null;
  inspectionId?: string | null;
  quantity: number;
  description: string;
  supplierName?: string | null;
  supplierUrl?: string | null;
  neededBy?: string | null;
  estimatedUnitCostCents?: number | null;
}

/** Field crews raise these straight off a repair ticket or a failed inspection. */
export async function createMaterialRequest(db: Db, actor: Actor, input: CreateRequestInput): Promise<string> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw badRequest("Enter how many you need");
  if (!input.description.trim() && !input.partId) throw badRequest("Say what you need");
  if (!input.repairTicketId && !input.inspectionId && !input.partId) {
    throw badRequest("Link the request to a part, a repair ticket, or an inspection");
  }

  const part = input.partId ? await requirePart(db, input.partId) : null;
  const id = newId("mrq");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO material_requests (id, status, part_id, repair_ticket_id, inspection_id, requested_by,
                                      requested_quantity, description, supplier_name, supplier_url, needed_by,
                                      estimated_unit_cost_cents, created_at, updated_at)
       VALUES (?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      part?.id ?? null,
      input.repairTicketId ?? null,
      input.inspectionId ?? null,
      actor.employeeId,
      input.quantity,
      input.description.trim() || `${part?.sku} — ${part?.name}`,
      input.supplierName?.trim() || part?.preferred_vendor || null,
      normalizeUrl(input.supplierUrl) ?? part?.product_url ?? null,
      input.neededBy ?? null,
      input.estimatedUnitCostCents ?? part?.preferred_unit_cost_cents ?? null,
      timestamp,
      timestamp,
    )
    .run();

  await notifyCategory(db, {
    category: "material_requested",
    title: `Material request from ${actor.displayName}`,
    body: `${input.quantity} × ${input.description.trim() || part?.name}${input.neededBy ? ` needed by ${input.neededBy}` : ""}.`,
    relatedType: "material_request",
    relatedId: id,
  });
  return id;
}

export async function listMaterialRequests(db: Db, filter: { status?: string; limit?: number } = {}): Promise<MaterialRequestRow[]> {
  const rows = await db
    .prepare(
      `SELECT m.id, m.status, m.part_id, p.sku, m.repair_ticket_id, r.ticket_number, m.inspection_id,
              m.requested_by, e.display_name AS requested_by_name, m.requested_quantity, m.description,
              m.supplier_name, m.supplier_url, m.needed_by, m.estimated_unit_cost_cents, m.created_at
         FROM material_requests m
         JOIN employees e ON e.id = m.requested_by
         LEFT JOIN parts p ON p.id = m.part_id
         LEFT JOIN repair_tickets r ON r.id = m.repair_ticket_id
        WHERE (?1 IS NULL OR m.status = ?1)
        ORDER BY CASE m.status WHEN 'requested' THEN 0 WHEN 'approved' THEN 1 WHEN 'ordered' THEN 2 ELSE 3 END,
                 m.needed_by IS NULL, m.needed_by, m.created_at
        LIMIT ?2`,
    )
    .bind(filter.status ?? null, filter.limit ?? 100)
    .all<MaterialRequestRow>();
  return rows.results;
}

const REQUEST_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export interface AdvanceRequestInput {
  requestId: string;
  status: (typeof REQUEST_STATUSES)[number];
  /** On `received`, the quantity that actually turned up. */
  receivedQuantity?: number | null;
}

export async function advanceMaterialRequest(db: Db, actor: Actor, input: AdvanceRequestInput): Promise<void> {
  const request = await db
    .prepare("SELECT * FROM material_requests WHERE id = ?")
    .bind(input.requestId)
    .first<{ id: string; status: string; part_id: string | null; requested_by: string; requested_quantity: number; description: string }>();
  if (!request) throw notFound("Material request not found");
  if (!REQUEST_TRANSITIONS[request.status]?.includes(input.status)) {
    throw badRequest(`A ${request.status} request cannot move to ${input.status}`);
  }

  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE material_requests
          SET status = ?,
              approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
              approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
              ordered_by = CASE WHEN ? = 'ordered' THEN ? ELSE ordered_by END,
              ordered_at = CASE WHEN ? = 'ordered' THEN ? ELSE ordered_at END,
              received_at = CASE WHEN ? = 'received' THEN ? ELSE received_at END,
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      input.status,
      input.status, actor.employeeId,
      input.status, timestamp,
      input.status, actor.employeeId,
      input.status, timestamp,
      input.status, timestamp,
      timestamp,
      request.id,
    )
    .run();

  // Receiving a stocked part puts it on the shelf.
  if (input.status === "received" && request.part_id) {
    const quantity = input.receivedQuantity ?? request.requested_quantity;
    if (quantity > 0) {
      await recordMovement(db, {
        partId: request.part_id,
        movementType: "received",
        quantity,
        recordedBy: actor.employeeId,
        notes: `Material request ${request.id}`,
      });
    }
  }

  if (request.requested_by !== actor.employeeId) {
    await notify(db, {
      employeeId: request.requested_by,
      category: "material_requested",
      title: `Your request is ${input.status}`,
      body: `${request.description} — ${actor.displayName} marked it ${input.status}.`,
      relatedType: "material_request",
      relatedId: request.id,
    });
  }
}
