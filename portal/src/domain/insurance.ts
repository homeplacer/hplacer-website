/** Private insurance-card records and renewal alerts for road equipment. */
import { uploadPhoto } from "./documents.ts";
import { notifyCategory } from "./notifications.ts";
import { badRequest } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, ObjectStore } from "../platform/types.ts";

export interface InsuranceCardRow {
  id: string;
  asset_id: string;
  asset_tag: string;
  document_id: string | null;
  provider: string;
  policy_number: string | null;
  effective_on: string | null;
  expires_on: string;
  status: "current" | "superseded" | "cancelled";
  file_name: string | null;
  created_at: string;
}

const SELECT_CARD = `
  SELECT c.*, a.asset_tag, d.file_name
    FROM asset_insurance_cards c
    JOIN assets a ON a.id = c.asset_id
    LEFT JOIN documents d ON d.id = c.document_id`;

export async function listInsuranceCards(db: Db, assetId: string): Promise<InsuranceCardRow[]> {
  const rows = await db
    .prepare(`${SELECT_CARD} WHERE c.asset_id = ? ORDER BY c.status = 'current' DESC, c.expires_on DESC, c.created_at DESC`)
    .bind(assetId)
    .all<InsuranceCardRow>();
  return rows.results;
}

export interface RecordInsuranceCardInput {
  assetId: string;
  provider: string;
  policyNumber?: string | null;
  effectiveOn?: string | null;
  expiresOn: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
  createdBy: string;
}

export async function recordInsuranceCard(
  db: Db,
  store: ObjectStore | undefined,
  input: RecordInsuranceCardInput,
): Promise<string> {
  const provider = input.provider.trim();
  const effectiveOn = input.effectiveOn?.trim() || null;
  const expiresOn = input.expiresOn.trim();
  if (!provider) throw badRequest("Insurance provider is required");
  if (effectiveOn && !isIsoDate(effectiveOn)) throw badRequest("Effective date must be YYYY-MM-DD");
  if (!isIsoDate(expiresOn)) throw badRequest("Expiration date must be YYYY-MM-DD");
  if (effectiveOn && effectiveOn > expiresOn) throw badRequest("Expiration date must be on or after the effective date");

  const caption = `${provider} insurance card${effectiveOn ? ` — effective ${effectiveOn}` : ""}; expires ${expiresOn}.`;
  const documentId = await uploadPhoto(db, store, input.createdBy, {
    documentType: "other",
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
    caption,
    target: { assetId: input.assetId },
  });

  const id = newId("ins");
  const timestamp = nowIso();
  await db.batch([
    db.prepare("UPDATE asset_insurance_cards SET status = 'superseded', updated_at = ? WHERE asset_id = ? AND status = 'current'")
      .bind(timestamp, input.assetId),
    db.prepare(
      `INSERT INTO asset_insurance_cards
        (id, asset_id, document_id, provider, policy_number, effective_on, expires_on, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?)`,
    ).bind(
      id,
      input.assetId,
      documentId,
      provider,
      input.policyNumber?.trim() || null,
      effectiveOn,
      expiresOn,
      input.createdBy,
      timestamp,
      timestamp,
    ),
  ]);
  return id;
}

/** Daily sweep with distinct 30-day, 7-day, and expired dedupe milestones. */
export async function notifyInsuranceExpirations(db: Db, now: Date = new Date()): Promise<number> {
  const cutoff = isoDate(addUtcDays(now, 30));
  const rows = await db
    .prepare(`${SELECT_CARD}
      WHERE c.status = 'current' AND a.status <> 'retired' AND c.expires_on <= ?
      ORDER BY c.expires_on, a.asset_tag`)
    .bind(cutoff)
    .all<InsuranceCardRow>();

  let sent = 0;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const card of rows.results) {
    const expiry = parseIsoDate(card.expires_on);
    if (expiry === null) continue;
    const days = Math.floor((expiry - today) / 86_400_000);
    const milestone = days < 0 ? "expired" : days <= 7 ? "7_day" : "30_day";
    const timing = days < 0
      ? `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
      : days === 0
        ? "expires today"
        : `expires in ${days} days`;
    sent += await notifyCategory(db, {
      category: "insurance_expiring",
      severity: days <= 7 ? "urgent" : "warning",
      title: `${card.asset_tag}: insurance ${days < 0 ? "expired" : "expires soon"}`,
      body: `${card.provider} card ${timing} (${card.expires_on}).`,
      relatedType: "asset",
      relatedId: card.asset_id,
      dedupeKey: `insurance:${card.id}:${card.expires_on}:${milestone}`,
    });
  }
  return sent;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseIsoDate(value) !== null;
}

function parseIsoDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? timestamp : null;
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
