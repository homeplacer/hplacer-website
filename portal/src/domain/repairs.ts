/**
 * Repair tickets and the bill-back queue.
 *
 * A ticket starts from a failed inspection line, an open defect, or a phone
 * call from the field. It accumulates labor, materials, and photos; a
 * supervisor names the responsible party; and billing (Tara) works the queue
 * from `review_needed` through `billed`.
 */
import { badRequest, conflict, forbidden, notFound } from "../platform/errors.ts";
import { newId, nowIso, repairTicketNumber } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { can, type Actor } from "../auth/authz.ts";
import { consumeStockForRepair } from "./inventory.ts";
import { notify, notifyCategory } from "./notifications.ts";

export const REPAIR_STATUSES = ["reported", "approved", "in_progress", "awaiting_parts", "complete", "billed", "closed"] as const;
export const BILL_BACK_STATUSES = ["not_applicable", "review_needed", "ready_to_bill", "billed", "denied"] as const;
export const RESPONSIBLE_PARTY_TYPES = [
  "manufacturer",
  "transporter",
  "setup_crew",
  "operator",
  "customer",
  "vendor",
  "internal",
  "unknown",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];
export type BillBackStatus = (typeof BILL_BACK_STATUSES)[number];

/** Only these moves are legal. Anything else is a bug or a stale form post. */
const STATUS_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  reported: ["approved", "in_progress", "closed"],
  approved: ["in_progress", "awaiting_parts", "closed"],
  in_progress: ["awaiting_parts", "complete", "closed"],
  awaiting_parts: ["in_progress", "complete", "closed"],
  complete: ["billed", "closed", "in_progress"],
  billed: ["closed"],
  closed: [],
};

const BILL_BACK_TRANSITIONS: Record<BillBackStatus, BillBackStatus[]> = {
  not_applicable: ["review_needed"],
  review_needed: ["ready_to_bill", "denied", "not_applicable"],
  ready_to_bill: ["billed", "denied", "review_needed"],
  billed: ["review_needed"],
  denied: ["review_needed"],
};

export interface RepairRow {
  id: string;
  ticket_number: string;
  status: string;
  bill_back_status: string;
  title: string;
  description: string;
  source_inspection_id: string | null;
  source_defect_id: string | null;
  job_id: string | null;
  lot_id: string | null;
  home_id: string | null;
  asset_id: string | null;
  reported_by: string;
  assigned_to: string | null;
  responsible_party: string | null;
  responsible_party_type: string | null;
  labor_minutes: number | null;
  billing_notes: string | null;
  bill_back_amount_cents: number | null;
  invoice_reference: string | null;
  approved_by: string | null;
  approved_at: string | null;
  billed_by: string | null;
  completed_at: string | null;
  billed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairSummary extends RepairRow {
  reported_by_name: string;
  assigned_to_name: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  job_number: string | null;
  labor_cents: number;
  material_cents: number;
  total_cents: number;
  photo_count: number;
}

const REPAIR_SELECT = `
  SELECT r.*, rb.display_name AS reported_by_name, ab.display_name AS assigned_to_name,
         h.serial_number, s.asset_tag, j.job_number,
         (SELECT ifnull(sum(round(l.minutes * l.rate_cents_per_hour / 60.0)), 0)
            FROM repair_labor_entries l WHERE l.repair_ticket_id = r.id) AS labor_cents,
         (SELECT ifnull(sum(round(m.quantity * m.unit_cost_cents)), 0)
            FROM repair_material_lines m WHERE m.repair_ticket_id = r.id) AS material_cents,
         (SELECT count(*) FROM documents d WHERE d.repair_ticket_id = r.id AND d.upload_status = 'stored') AS photo_count
    FROM repair_tickets r
    JOIN employees rb ON rb.id = r.reported_by
    LEFT JOIN employees ab ON ab.id = r.assigned_to
    LEFT JOIN homes h ON h.id = r.home_id
    LEFT JOIN assets s ON s.id = r.asset_id
    LEFT JOIN jobs j ON j.id = r.job_id`;

function withTotals(row: RepairSummary): RepairSummary {
  return { ...row, total_cents: (row.labor_cents ?? 0) + (row.material_cents ?? 0) };
}

export interface RepairFilter {
  status?: string;
  billBackStatus?: string;
  homeId?: string;
  assetId?: string;
  openOnly?: boolean;
  limit?: number;
}

export async function listRepairs(db: Db, actor: Actor, filter: RepairFilter = {}): Promise<RepairSummary[]> {
  const restrictToActor = can(actor, "repair.read.all") ? null : actor.employeeId;
  const rows = await db
    .prepare(
      `${REPAIR_SELECT}
        WHERE (?1 IS NULL OR r.reported_by = ?1 OR r.assigned_to = ?1)
          AND (?2 IS NULL OR r.status = ?2)
          AND (?3 IS NULL OR r.bill_back_status = ?3)
          AND (?4 IS NULL OR r.home_id = ?4)
          AND (?5 IS NULL OR r.asset_id = ?5)
          AND (?6 = 0 OR r.status NOT IN ('billed', 'closed'))
        ORDER BY r.status IN ('billed', 'closed'), r.created_at DESC
        LIMIT ?7`,
    )
    .bind(
      restrictToActor,
      filter.status ?? null,
      filter.billBackStatus ?? null,
      filter.homeId ?? null,
      filter.assetId ?? null,
      filter.openOnly ? 1 : 0,
      filter.limit ?? 100,
    )
    .all<RepairSummary>();
  return rows.results.map(withTotals);
}

export async function getRepair(db: Db, idOrNumber: string): Promise<RepairSummary | null> {
  const row = await db
    .prepare(`${REPAIR_SELECT} WHERE r.id = ?1 OR r.ticket_number = ?1`)
    .bind(idOrNumber)
    .first<RepairSummary>();
  return row ? withTotals(row) : null;
}

export async function requireRepair(db: Db, idOrNumber: string): Promise<RepairSummary> {
  const repair = await getRepair(db, idOrNumber);
  if (!repair) throw notFound("Repair ticket not found");
  return repair;
}

/** Reading a ticket you neither raised nor own needs `repair.read.all`. */
export function assertCanViewRepair(actor: Actor, repair: RepairRow): void {
  if (can(actor, "repair.read.all")) return;
  if (repair.reported_by === actor.employeeId || repair.assigned_to === actor.employeeId) return;
  throw forbidden("That repair ticket belongs to another crew");
}

export interface CreateRepairInput {
  title: string;
  description: string;
  homeId?: string | null;
  assetId?: string | null;
  jobId?: string | null;
  lotId?: string | null;
  sourceInspectionId?: string | null;
  sourceDefectId?: string | null;
  responsibleParty?: string | null;
  responsiblePartyType?: string | null;
  billBack?: boolean;
  assignedTo?: string | null;
}

export async function createRepair(db: Db, actor: Actor, input: CreateRepairInput, now: Date = new Date()): Promise<string> {
  if (!input.title.trim()) throw badRequest("Give the ticket a short title");
  if (!input.description.trim()) throw badRequest("Describe the problem");
  if (input.homeId && input.assetId) throw badRequest("A ticket covers a home or a machine, not both");
  if (input.responsiblePartyType && !(RESPONSIBLE_PARTY_TYPES as readonly string[]).includes(input.responsiblePartyType)) {
    throw badRequest(`Unknown responsible party "${input.responsiblePartyType}"`);
  }

  let defect: { id: string; home_id: string | null; asset_id: string | null; job_id: string | null } | null = null;
  if (input.sourceDefectId) {
    defect = await db
      .prepare("SELECT id, home_id, asset_id, job_id FROM defects WHERE id = ?")
      .bind(input.sourceDefectId)
      .first<{ id: string; home_id: string | null; asset_id: string | null; job_id: string | null }>();
    if (!defect) throw notFound("Defect not found");
  }

  // A ticket raised from a defect inherits that defect's subject, so the
  // subject check runs after the defect has been resolved.
  const homeId = input.homeId ?? defect?.home_id ?? null;
  const assetId = input.assetId ?? defect?.asset_id ?? null;
  if (!homeId && !assetId) throw badRequest("A ticket has to name a home or a machine");

  const id = newId("rep");
  const timestamp = nowIso(now);
  const billBack = input.billBack ?? false;

  await insertWithTicketNumber(db, now, async (ticketNumber) => {
    await db
      .prepare(
        `INSERT INTO repair_tickets (id, ticket_number, status, bill_back_status, title, description,
                                     source_inspection_id, source_defect_id, job_id, lot_id, home_id, asset_id,
                                     reported_by, assigned_to, responsible_party, responsible_party_type,
                                     created_at, updated_at)
         VALUES (?, ?, 'reported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        ticketNumber,
        billBack ? "review_needed" : "not_applicable",
        input.title.trim(),
        input.description.trim(),
        input.sourceInspectionId ?? null,
        input.sourceDefectId ?? null,
        input.jobId ?? defect?.job_id ?? null,
        input.lotId ?? null,
        homeId,
        assetId,
        actor.employeeId,
        input.assignedTo ?? null,
        input.responsibleParty?.trim() || null,
        input.responsiblePartyType ?? null,
        timestamp,
        timestamp,
      )
      .run();
  });

  if (defect) {
    await db
      .prepare("UPDATE defects SET status = 'ticketed', repair_ticket_id = ?, updated_at = ? WHERE id = ?")
      .bind(id, timestamp, defect.id)
      .run();
  }

  const target = homeId ? "home" : "equipment";
  await notifyCategory(db, {
    category: "repair_reported",
    severity: "warning",
    title: `New repair on ${target}: ${input.title.trim()}`,
    body: `${actor.displayName} reported: ${input.description.trim().slice(0, 240)}`,
    relatedType: "repair_ticket",
    relatedId: id,
  });
  if (billBack) {
    await notifyCategory(db, {
      category: "billing_ready",
      title: `Bill-back review: ${input.title.trim()}`,
      body: `${actor.displayName} flagged this ticket for bill-back review.`,
      relatedType: "repair_ticket",
      relatedId: id,
    });
  }
  return id;
}

/**
 * Ticket numbers are human-facing (`RT-2026-0143`), so they are dense and
 * sequential rather than random. The unique index is the arbiter: on a
 * collision we recount and retry.
 */
async function insertWithTicketNumber(db: Db, now: Date, insert: (ticketNumber: string) => Promise<void>): Promise<void> {
  const year = now.getUTCFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await db
      .prepare("SELECT count(*) AS n FROM repair_tickets WHERE ticket_number LIKE ?")
      .bind(`RT-${year}-%`)
      .first<{ n: number }>();
    const candidate = repairTicketNumber((row?.n ?? 0) + 1 + attempt, now);
    try {
      await insert(candidate);
      return;
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw conflict("Could not allocate a ticket number — try again");
}

export async function setRepairStatus(
  db: Db,
  actor: Actor,
  repairId: string,
  status: RepairStatus,
  note?: string | null,
): Promise<void> {
  const repair = await requireRepair(db, repairId);
  const from = repair.status as RepairStatus;
  if (from === status) return;
  if (!STATUS_TRANSITIONS[from]?.includes(status)) {
    throw badRequest(`A ${from.replace("_", " ")} ticket cannot move straight to ${status.replace("_", " ")}`);
  }
  if (status === "billed") throw badRequest("Mark a ticket billed from the billing queue");

  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE repair_tickets
          SET status = ?,
              approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
              approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
              completed_at = CASE WHEN ? = 'complete' THEN ? ELSE completed_at END,
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, status, actor.employeeId, status, timestamp, status, timestamp, timestamp, repair.id)
    .run();

  await recordStatusEvent(db, actor, repair.id, "status", from, status, note ?? null);

  if (status === "complete" && repair.bill_back_status === "review_needed") {
    await notifyCategory(db, {
      category: "billing_ready",
      title: `${repair.ticket_number} is complete and awaiting bill-back review`,
      body: `${repair.title} — labor and materials are recorded on the ticket.`,
      relatedType: "repair_ticket",
      relatedId: repair.id,
      dedupeKey: `billing_review:${repair.id}`,
    });
  }
}

export async function setResponsibleParty(
  db: Db,
  actor: Actor,
  repairId: string,
  partyType: string,
  party: string | null,
): Promise<void> {
  if (!(RESPONSIBLE_PARTY_TYPES as readonly string[]).includes(partyType)) {
    throw badRequest(`Unknown responsible party "${partyType}"`);
  }
  const repair = await requireRepair(db, repairId);
  await db
    .prepare("UPDATE repair_tickets SET responsible_party_type = ?, responsible_party = ?, updated_at = ? WHERE id = ?")
    .bind(partyType, party?.trim() || null, nowIso(), repair.id)
    .run();
  await recordStatusEvent(db, actor, repair.id, "responsible_party", repair.responsible_party_type, partyType, party ?? null);
}

export interface BillBackUpdate {
  repairId: string;
  billBackStatus: BillBackStatus;
  amountCents?: number | null;
  invoiceReference?: string | null;
  notes?: string | null;
}

/**
 * The billing queue transition. Guarded by `repair.bill`, so a supervisor can
 * flag a ticket for review but cannot mark it billed.
 */
export async function updateBillBack(db: Db, actor: Actor, update: BillBackUpdate): Promise<void> {
  const repair = await requireRepair(db, update.repairId);
  const from = repair.bill_back_status as BillBackStatus;
  if (!(BILL_BACK_STATUSES as readonly string[]).includes(update.billBackStatus)) {
    throw badRequest(`Unknown bill-back status "${update.billBackStatus}"`);
  }
  if (from !== update.billBackStatus && !BILL_BACK_TRANSITIONS[from]?.includes(update.billBackStatus)) {
    throw badRequest(`Bill-back cannot move from ${from.replace("_", " ")} to ${update.billBackStatus.replace("_", " ")}`);
  }

  if (update.billBackStatus === "ready_to_bill" || update.billBackStatus === "billed") {
    if (!repair.responsible_party_type || repair.responsible_party_type === "unknown") {
      throw badRequest("Name the responsible party before billing the work back");
    }
    if (update.billBackStatus === "billed") {
      if (repair.status !== "complete" && repair.status !== "billed") {
        throw badRequest("Finish the repair before billing it back");
      }
      if (!update.amountCents || update.amountCents <= 0) throw badRequest("Enter the amount being billed back");
      if (!update.invoiceReference?.trim()) throw badRequest("Record the invoice reference");
    }
  }

  const timestamp = nowIso();
  const billed = update.billBackStatus === "billed";
  await db
    .prepare(
      `UPDATE repair_tickets
          SET bill_back_status = ?,
              bill_back_amount_cents = ifnull(?, bill_back_amount_cents),
              invoice_reference = ifnull(?, invoice_reference),
              billing_notes = ifnull(?, billing_notes),
              status = CASE WHEN ? = 1 THEN 'billed' ELSE status END,
              billed_at = CASE WHEN ? = 1 THEN ? ELSE billed_at END,
              billed_by = CASE WHEN ? = 1 THEN ? ELSE billed_by END,
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      update.billBackStatus,
      update.amountCents ?? null,
      update.invoiceReference?.trim() || null,
      update.notes?.trim() || null,
      billed ? 1 : 0,
      billed ? 1 : 0,
      timestamp,
      billed ? 1 : 0,
      actor.employeeId,
      timestamp,
      repair.id,
    )
    .run();

  await recordStatusEvent(db, actor, repair.id, "bill_back_status", from, update.billBackStatus, update.notes ?? null);

  if (billed && repair.reported_by !== actor.employeeId) {
    await notify(db, {
      employeeId: repair.reported_by,
      category: "billing_ready",
      title: `${repair.ticket_number} billed back`,
      body: `${actor.displayName} billed ${formatCents(update.amountCents ?? 0)} to ${repair.responsible_party ?? repair.responsible_party_type}.`,
      relatedType: "repair_ticket",
      relatedId: repair.id,
    });
  }
}

export async function billingQueue(db: Db, limit = 100): Promise<RepairSummary[]> {
  const rows = await db
    .prepare(
      `${REPAIR_SELECT}
        WHERE r.bill_back_status IN ('review_needed', 'ready_to_bill')
        ORDER BY CASE r.bill_back_status WHEN 'ready_to_bill' THEN 0 ELSE 1 END, r.created_at
        LIMIT ?`,
    )
    .bind(limit)
    .all<RepairSummary>();
  return rows.results.map(withTotals);
}

// ---------------------------------------------------------------------------
// Labor and materials
// ---------------------------------------------------------------------------

export interface LaborInput {
  repairId: string;
  employeeId: string;
  workedOn: string;
  minutes: number;
  rateCentsPerHour: number;
  description?: string | null;
}

export async function addLabor(db: Db, actor: Actor, input: LaborInput): Promise<string> {
  const repair = await requireRepair(db, input.repairId);
  if (repair.status === "closed") throw badRequest("This ticket is closed");
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) throw badRequest("Enter the minutes worked");
  if (input.minutes > 24 * 60) throw badRequest("That is more than a day on one entry — split it up");
  if (!Number.isFinite(input.rateCentsPerHour) || input.rateCentsPerHour < 0) throw badRequest("Enter a valid labor rate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workedOn)) throw badRequest("Date worked must look like 2026-08-21");

  const id = newId("lab");
  await db
    .prepare(
      `INSERT INTO repair_labor_entries (id, repair_ticket_id, employee_id, worked_on, minutes, rate_cents_per_hour, description, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      repair.id,
      input.employeeId,
      input.workedOn,
      Math.round(input.minutes),
      Math.round(input.rateCentsPerHour),
      input.description?.trim() || null,
      actor.employeeId,
      nowIso(),
    )
    .run();

  // Keep the denormalised roll-up on the ticket honest.
  await db
    .prepare(
      `UPDATE repair_tickets
          SET labor_minutes = (SELECT ifnull(sum(minutes), 0) FROM repair_labor_entries WHERE repair_ticket_id = ?),
              updated_at = ? WHERE id = ?`,
    )
    .bind(repair.id, nowIso(), repair.id)
    .run();
  return id;
}

export interface MaterialInput {
  repairId: string;
  partId?: string | null;
  description: string;
  quantity: number;
  unitCostCents: number;
  /** Draw the quantity out of shop stock as well as charging it to the ticket. */
  consumeStock?: boolean;
}

export async function addMaterial(db: Db, actor: Actor, input: MaterialInput): Promise<string> {
  const repair = await requireRepair(db, input.repairId);
  if (repair.status === "closed") throw badRequest("This ticket is closed");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw badRequest("Enter a quantity");
  if (!Number.isFinite(input.unitCostCents) || input.unitCostCents < 0) throw badRequest("Enter a valid unit cost");
  if (!input.partId && !input.description.trim()) throw badRequest("Describe the material used");

  let movementId: string | null = null;
  if (input.partId && input.consumeStock) {
    movementId = await consumeStockForRepair(db, actor, {
      partId: input.partId,
      quantity: input.quantity,
      repairTicketId: repair.id,
    });
  }

  const id = newId("mat");
  await db
    .prepare(
      `INSERT INTO repair_material_lines (id, repair_ticket_id, part_id, description, quantity, unit_cost_cents, inventory_movement_id, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      repair.id,
      input.partId ?? null,
      input.description.trim(),
      input.quantity,
      Math.round(input.unitCostCents),
      movementId,
      actor.employeeId,
      nowIso(),
    )
    .run();
  return id;
}

export interface LaborRow {
  id: string;
  employee_name: string;
  worked_on: string;
  minutes: number;
  rate_cents_per_hour: number;
  description: string | null;
}

export async function listLabor(db: Db, repairId: string): Promise<LaborRow[]> {
  const rows = await db
    .prepare(
      `SELECT l.id, e.display_name AS employee_name, l.worked_on, l.minutes, l.rate_cents_per_hour, l.description
         FROM repair_labor_entries l JOIN employees e ON e.id = l.employee_id
        WHERE l.repair_ticket_id = ? ORDER BY l.worked_on, l.created_at`,
    )
    .bind(repairId)
    .all<LaborRow>();
  return rows.results;
}

export interface MaterialRow {
  id: string;
  part_id: string | null;
  sku: string | null;
  description: string;
  quantity: number;
  unit_cost_cents: number;
}

export async function listMaterials(db: Db, repairId: string): Promise<MaterialRow[]> {
  const rows = await db
    .prepare(
      `SELECT m.id, m.part_id, p.sku, m.description, m.quantity, m.unit_cost_cents
         FROM repair_material_lines m LEFT JOIN parts p ON p.id = m.part_id
        WHERE m.repair_ticket_id = ? ORDER BY m.created_at`,
    )
    .bind(repairId)
    .all<MaterialRow>();
  return rows.results;
}

export interface StatusEventRow {
  id: string;
  field: string;
  from_value: string | null;
  to_value: string;
  note: string | null;
  changed_by_name: string;
  created_at: string;
}

export async function listStatusEvents(db: Db, repairId: string): Promise<StatusEventRow[]> {
  const rows = await db
    .prepare(
      `SELECT s.id, s.field, s.from_value, s.to_value, s.note, e.display_name AS changed_by_name, s.created_at
         FROM repair_status_events s JOIN employees e ON e.id = s.changed_by
        WHERE s.repair_ticket_id = ? ORDER BY s.created_at DESC, s.rowid DESC`,
    )
    .bind(repairId)
    .all<StatusEventRow>();
  return rows.results;
}

async function recordStatusEvent(
  db: Db,
  actor: Actor,
  repairId: string,
  field: "status" | "bill_back_status" | "responsible_party",
  fromValue: string | null,
  toValue: string,
  note: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO repair_status_events (id, repair_ticket_id, field, from_value, to_value, note, changed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId("evt"), repairId, field, fromValue, toValue, note?.trim() || null, actor.employeeId, nowIso())
    .run();
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
