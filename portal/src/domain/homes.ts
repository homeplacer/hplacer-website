/**
 * Manufactured homes, keyed by serial number.
 *
 * The serial number is the spine of the record: delivery report, setup report,
 * final inspection, every repair, and every bill-back all hang off it, and it
 * is the canonical key the Monday link registry uses.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { canonicalKey, newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { normalizeAddress, normalizeName, normalizePhone } from "./matching.ts";

export const HOME_STATUSES = ["delivery_pending", "installed", "inspection_pending", "complete", "service"] as const;

export interface HomeRow {
  id: string;
  serial_number: string;
  manufacturer: string | null;
  model: string | null;
  model_year: number | null;
  section_count: number | null;
  hud_label_numbers: string | null;
  job_id: string | null;
  lot_id: string | null;
  status: string;
  delivered_on: string | null;
  setup_completed_on: string | null;
  final_inspection_on: string | null;
  warranty_expires_on: string | null;
  monday_item_id: string | null;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_postal_code: string | null;
  site_address_key: string | null;
  site_address_notes: string | null;
  customer_name: string | null;
  customer_name_key: string | null;
  customer_phone: string | null;
  customer_phone_key: string | null;
  customer_email: string | null;
}

/** The one-line address a crew or a homeowner would say out loud. */
export function formatSiteAddress(home: Pick<HomeRow, "site_address" | "site_city" | "site_state" | "site_postal_code">): string | null {
  if (!home.site_address) return null;
  const tail = [home.site_city, home.site_state].filter(Boolean).join(", ");
  return [home.site_address, tail, home.site_postal_code].filter(Boolean).join(" · ");
}

export interface HomeSummary extends HomeRow {
  job_number: string | null;
  job_title: string | null;
  lot_number: string | null;
  open_repair_count: number;
}

export async function listHomes(db: Db, options: { status?: string; jobId?: string; search?: string } = {}): Promise<HomeSummary[]> {
  const rows = await db
    .prepare(
      `SELECT h.*, j.job_number, j.title AS job_title, l.lot_number,
              (SELECT count(*) FROM repair_tickets r WHERE r.home_id = h.id
                 AND r.status NOT IN ('complete', 'billed', 'closed')) AS open_repair_count
         FROM homes h
         LEFT JOIN jobs j ON j.id = h.job_id
         LEFT JOIN lots l ON l.id = h.lot_id
        WHERE (?1 IS NULL OR h.status = ?1)
          AND (?2 IS NULL OR h.job_id = ?2)
          AND (?3 IS NULL OR h.serial_number LIKE ?3 OR ifnull(h.model, '') LIKE ?3 OR ifnull(h.manufacturer, '') LIKE ?3
               OR upper(ifnull(h.site_address, '')) LIKE ?3 OR upper(ifnull(h.customer_name, '')) LIKE ?3)
        ORDER BY h.status, h.serial_number`,
    )
    .bind(options.status ?? null, options.jobId ?? null, options.search ? `%${options.search.toUpperCase()}%` : null)
    .all<HomeSummary>();
  return rows.results;
}

export async function getHome(db: Db, idOrSerial: string): Promise<HomeRow | null> {
  const home = await db.prepare("SELECT * FROM homes WHERE id = ?").bind(idOrSerial).first<HomeRow>();
  if (home) return home;
  return db.prepare("SELECT * FROM homes WHERE serial_number = ?").bind(canonicalKey(idOrSerial)).first<HomeRow>();
}

export async function requireHome(db: Db, idOrSerial: string): Promise<HomeRow> {
  const home = await getHome(db, idOrSerial);
  if (!home) throw notFound("Home not found");
  return home;
}

export interface CreateHomeInput {
  serialNumber: string;
  manufacturer?: string | null;
  model?: string | null;
  modelYear?: number | null;
  sectionCount?: number | null;
  hudLabelNumbers?: string | null;
  jobId?: string | null;
  lotId?: string | null;
  warrantyExpiresOn?: string | null;
  siteAddress?: SiteAddressInput | null;
}

export async function createHome(db: Db, input: CreateHomeInput): Promise<string> {
  const serial = canonicalKey(input.serialNumber ?? "");
  if (serial.length < 4) throw badRequest("Enter the full serial number from the data plate");

  const existing = await db.prepare("SELECT id FROM homes WHERE serial_number = ?").bind(serial).first<{ id: string }>();
  if (existing) throw conflict(`Serial number ${serial} is already in the portal`);

  if (input.lotId) {
    const lot = await db.prepare("SELECT job_id FROM lots WHERE id = ?").bind(input.lotId).first<{ job_id: string }>();
    if (!lot) throw notFound("Lot not found");
    if (input.jobId && input.jobId !== lot.job_id) throw badRequest("That lot belongs to a different job");
  }

  const id = newId("hom");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO homes (id, serial_number, manufacturer, model, model_year, section_count, hud_label_numbers,
                          job_id, lot_id, status, warranty_expires_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivery_pending', ?, ?, ?)`,
    )
    .bind(
      id,
      serial,
      input.manufacturer ?? null,
      input.model ?? null,
      input.modelYear ?? null,
      input.sectionCount ?? null,
      input.hudLabelNumbers ?? null,
      input.jobId ?? null,
      input.lotId ?? null,
      input.warrantyExpiresOn ?? null,
      timestamp,
      timestamp,
    )
    .run();

  if (input.siteAddress && hasSiteAddressContent(input.siteAddress)) {
    await updateSiteAddress(db, id, input.siteAddress);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Site address and owner of record
//
// Both are optional. A home is filed under its serial number; the address and
// the owner exist so a homeowner who only knows "12 Bend Road" can still be
// matched to their home when they submit a warranty request.
// ---------------------------------------------------------------------------

export interface SiteAddressInput {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}

function hasSiteAddressContent(input: SiteAddressInput): boolean {
  return Boolean(
    input.address?.trim() ||
      input.city?.trim() ||
      input.postalCode?.trim() ||
      input.notes?.trim() ||
      input.customerName?.trim() ||
      input.customerPhone?.trim() ||
      input.customerEmail?.trim(),
  );
}

/**
 * Writes the address and owner, and the normalized keys warranty matching
 * compares against. The keys are derived here and never accepted from a caller,
 * so a stored key always agrees with the text beside it.
 */
export async function updateSiteAddress(db: Db, homeId: string, input: SiteAddressInput): Promise<void> {
  const address = input.address?.trim() || null;
  const city = input.city?.trim() || null;
  const state = input.state?.trim().toUpperCase().slice(0, 2) || null;
  const postalCode = input.postalCode?.trim() || null;

  if (postalCode && !/^\d{5}(-\d{4})?$/.test(postalCode)) throw badRequest("ZIP should look like 28607");

  const phone = input.customerPhone?.trim() || null;
  const phoneKey = normalizePhone(phone);
  if (phone && !phoneKey) throw badRequest("Enter a 10-digit phone number, or leave it blank");

  const email = input.customerEmail?.trim() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("That email does not look right");

  const addressKey = normalizeAddress({ address, city, state, postalCode });
  const customerName = input.customerName?.trim() || null;

  const result = await db
    .prepare(
      `UPDATE homes
          SET site_address = ?, site_city = ?, site_state = ?, site_postal_code = ?,
              site_address_key = ?, site_address_notes = ?,
              customer_name = ?, customer_name_key = ?, customer_phone = ?, customer_phone_key = ?, customer_email = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      address,
      city,
      state,
      postalCode,
      addressKey?.key ?? null,
      input.notes?.trim() || null,
      customerName,
      normalizeName(customerName),
      phone,
      phoneKey,
      email,
      nowIso(),
      homeId,
    )
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Home not found");
}

export async function assignHomeToLot(db: Db, homeId: string, lotId: string): Promise<void> {
  const lot = await db.prepare("SELECT id, job_id FROM lots WHERE id = ?").bind(lotId).first<{ id: string; job_id: string }>();
  if (!lot) throw notFound("Lot not found");
  const result = await db
    .prepare("UPDATE homes SET lot_id = ?, job_id = ?, updated_at = ? WHERE id = ?")
    .bind(lot.id, lot.job_id, nowIso(), homeId)
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Home not found");
}

export interface HomeReportSummary {
  kind: "delivery" | "setup" | "final_inspection";
  label: string;
  inspection_id: string | null;
  status: string | null;
  performed_at: string | null;
  performed_by_name: string | null;
  defect_count: number;
}

const REPORT_KINDS: { kind: HomeReportSummary["kind"]; label: string; templateKey: string }[] = [
  { kind: "delivery", label: "Delivery report", templateKey: "home_delivery" },
  { kind: "setup", label: "Setup report", templateKey: "home_setup" },
  { kind: "final_inspection", label: "Final inspection", templateKey: "home_final" },
];

export function homeReportTemplateKey(kind: HomeReportSummary["kind"]): string {
  const entry = REPORT_KINDS.find((report) => report.kind === kind);
  if (!entry) throw badRequest(`Unknown report "${kind}"`);
  return entry.templateKey;
}

/** The three-report jacket for a home, filled in or still blank. */
export async function homeReports(db: Db, homeId: string): Promise<HomeReportSummary[]> {
  const rows = await db
    .prepare(
      `SELECT i.id, i.inspection_kind, i.status, i.performed_at, e.display_name AS performed_by_name,
              (SELECT count(*) FROM defects d WHERE d.inspection_id = i.id) AS defect_count
         FROM inspections i JOIN employees e ON e.id = i.performed_by
        WHERE i.home_id = ? ORDER BY i.performed_at DESC`,
    )
    .bind(homeId)
    .all<{ id: string; inspection_kind: string; status: string; performed_at: string; performed_by_name: string; defect_count: number }>();

  return REPORT_KINDS.map((report) => {
    const latest = rows.results.find((row) => row.inspection_kind === report.kind);
    return {
      kind: report.kind,
      label: report.label,
      inspection_id: latest?.id ?? null,
      status: latest?.status ?? null,
      performed_at: latest?.performed_at ?? null,
      performed_by_name: latest?.performed_by_name ?? null,
      defect_count: latest?.defect_count ?? 0,
    };
  });
}

export interface HomeRepairHistoryRow {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  bill_back_status: string;
  responsible_party: string | null;
  responsible_party_type: string | null;
  bill_back_amount_cents: number | null;
  created_at: string;
  billed_at: string | null;
}

export async function homeRepairHistory(db: Db, homeId: string): Promise<HomeRepairHistoryRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, ticket_number, title, status, bill_back_status, responsible_party, responsible_party_type,
              bill_back_amount_cents, created_at, billed_at
         FROM repair_tickets WHERE home_id = ? ORDER BY created_at DESC`,
    )
    .bind(homeId)
    .all<HomeRepairHistoryRow>();
  return rows.results;
}
