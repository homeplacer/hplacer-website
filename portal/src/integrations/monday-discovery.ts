/**
 * Read-only discovery: reading a Monday board and working out which portal
 * record each item corresponds to.
 *
 * Everything here is a pure function over data already fetched, plus one index
 * builder that reads the portal database. Nothing in this file writes anything —
 * to Monday or to D1. The output is a *plan*: what discovery believes, item by
 * item, with the ones it is not sure about marked as such. An operator reads the
 * plan; only then, and only with an explicit flag, does
 * `portal/ops/monday-discover.ts` write the links it describes.
 *
 * Items are matched on the same canonical business keys the rest of the portal
 * uses — serial number, VIN, asset tag, subdivision number, ticket number —
 * never on an item's name or its position on a board.
 */
import { canonicalKey } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import type { CanonicalKeyKind, MondayBoardKey, MondayEntityType } from "./monday.ts";
import type { MondayItem } from "./monday-client.ts";

export interface PortalRecord {
  entityType: MondayEntityType;
  entityId: string;
  canonicalKey: string;
  label: string;
}

export interface PortalIndex {
  kind: CanonicalKeyKind;
  byKey: Map<string, PortalRecord[]>;
  /** entityId → the Monday item it is already linked to. */
  linkedEntity: Map<string, { mondayItemId: string; syncState: string }>;
  /** mondayItemId → the portal record already claiming it. */
  linkedItem: Map<string, { entityType: string; entityId: string }>;
}

const ENTITY_FOR_BOARD: Record<MondayBoardKey, MondayEntityType> = {
  homes: "home",
  equipment: "asset",
  jobs: "job",
  tasks: "work_task",
  repairs: "repair_ticket",
};

/** Loads every portal record a board could correspond to, keyed canonically. */
export async function buildPortalIndex(db: Db, boardKey: MondayBoardKey, kind: CanonicalKeyKind): Promise<PortalIndex> {
  const entityType = ENTITY_FOR_BOARD[boardKey];
  const byKey = new Map<string, PortalRecord[]>();

  const add = (record: PortalRecord) => {
    if (!record.canonicalKey) return;
    const list = byKey.get(record.canonicalKey) ?? [];
    list.push(record);
    byKey.set(record.canonicalKey, list);
  };

  if (entityType === "home") {
    const rows = await db.prepare("SELECT id, serial_number FROM homes").all<{ id: string; serial_number: string }>();
    for (const row of rows.results) {
      add({ entityType, entityId: row.id, canonicalKey: canonicalKey(row.serial_number), label: row.serial_number });
    }
  } else if (entityType === "asset") {
    const rows = await db
      .prepare("SELECT id, asset_tag, serial_number, vin FROM assets")
      .all<{ id: string; asset_tag: string; serial_number: string | null; vin: string | null }>();
    for (const row of rows.results) {
      const value = kind === "vin" ? row.vin : kind === "serial_number" ? row.serial_number : row.asset_tag;
      if (!value) continue;
      add({ entityType, entityId: row.id, canonicalKey: canonicalKey(value), label: row.asset_tag });
    }
  } else if (entityType === "job") {
    const rows = await db.prepare("SELECT id, job_number, title FROM jobs").all<{ id: string; job_number: string; title: string }>();
    for (const row of rows.results) {
      add({ entityType, entityId: row.id, canonicalKey: canonicalKey(row.job_number), label: `${row.job_number} — ${row.title}` });
    }
  } else if (entityType === "repair_ticket") {
    const rows = await db.prepare("SELECT id, ticket_number, title FROM repair_tickets").all<{ id: string; ticket_number: string; title: string }>();
    for (const row of rows.results) {
      add({ entityType, entityId: row.id, canonicalKey: canonicalKey(row.ticket_number), label: `${row.ticket_number} — ${row.title}` });
    }
  } else {
    const rows = await db
      .prepare("SELECT t.id, t.title, j.job_number FROM work_tasks t LEFT JOIN jobs j ON j.id = t.job_id WHERE j.job_number IS NOT NULL")
      .all<{ id: string; title: string; job_number: string }>();
    for (const row of rows.results) {
      add({ entityType, entityId: row.id, canonicalKey: canonicalKey(row.job_number), label: row.title });
    }
  }

  const links = await db
    .prepare("SELECT entity_type, entity_id, monday_item_id, sync_state FROM monday_links WHERE board_key = ?")
    .bind(boardKey)
    .all<{ entity_type: string; entity_id: string; monday_item_id: string; sync_state: string }>();

  const linkedEntity = new Map<string, { mondayItemId: string; syncState: string }>();
  const linkedItem = new Map<string, { entityType: string; entityId: string }>();
  for (const link of links.results) {
    linkedEntity.set(link.entity_id, { mondayItemId: link.monday_item_id, syncState: link.sync_state });
    linkedItem.set(link.monday_item_id, { entityType: link.entity_type, entityId: link.entity_id });
  }

  return { kind, byKey, linkedEntity, linkedItem };
}

// ---------------------------------------------------------------------------
// Reading a canonical key out of a Monday item
// ---------------------------------------------------------------------------

const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
const ASSET_TAG_PATTERN = /\b[A-Z]{2,4}-?\d{1,4}\b/g;
const JOB_NUMBER_PATTERN = /\b[A-Z]{2,4}-?\d{3,6}\b/g;
const TICKET_PATTERN = /\bRT-?\d{4}-?\d{3,5}\b/gi;
const SERIAL_PATTERN = /\b[A-Z0-9][A-Z0-9-]{5,}\b/g;

export interface KeyExtraction {
  key: string;
  /** Where it came from, for the report. */
  source: string;
}

/**
 * Pulls every plausible canonical key out of an item's name and column values.
 *
 * `preferColumns` (ids or titles) is checked first when the operator knows which
 * column holds the key; otherwise every text column is scanned. Returning
 * several candidates is fine — the plan resolves them against the portal index
 * and reports the ones that hit more than one record.
 */
export function extractCandidateKeys(
  item: MondayItem,
  kind: CanonicalKeyKind,
  options: { preferColumns?: string[]; columnTitles?: Map<string, string> } = {},
): KeyExtraction[] {
  const prefer = new Set((options.preferColumns ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  const fields: { source: string; text: string }[] = [];

  for (const column of item.column_values ?? []) {
    if (!column.text) continue;
    const title = options.columnTitles?.get(column.id) ?? column.id;
    const preferred = prefer.has(column.id.toLowerCase()) || prefer.has(title.toLowerCase());
    fields.push({ source: `column:${title}`, text: column.text });
    if (preferred) fields.unshift({ source: `column:${title}`, text: column.text });
  }
  fields.push({ source: "item name", text: item.name ?? "" });

  // With an explicit column, only that column is trusted.
  const scanned = prefer.size > 0 ? fields.filter((field) => prefer.has(field.source.slice("column:".length).toLowerCase())) : fields;

  const pattern =
    kind === "vin" ? VIN_PATTERN
    : kind === "asset_tag" ? ASSET_TAG_PATTERN
    : kind === "job_number" ? JOB_NUMBER_PATTERN
    : kind === "ticket_number" ? TICKET_PATTERN
    : SERIAL_PATTERN;

  const seen = new Set<string>();
  const out: KeyExtraction[] = [];
  for (const field of scanned) {
    const text = field.text.toUpperCase();
    pattern.lastIndex = 0;
    for (const found of text.matchAll(pattern)) {
      const key = canonicalKey(found[0]);
      if (!key || key.length < minimumLength(kind) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, source: field.source });
    }
  }
  return out;
}

function minimumLength(kind: CanonicalKeyKind): number {
  switch (kind) {
    case "vin":
      return 17;
    case "asset_tag":
      return 3;
    case "job_number":
      return 5;
    case "ticket_number":
      return 8;
    default:
      return 6;
  }
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type ItemOutcome = "match" | "already_linked" | "ambiguous" | "unmatched" | "conflict";

export interface ItemPlan {
  monday_item_id: string;
  item_name: string;
  outcome: ItemOutcome;
  canonical_key: string | null;
  key_source: string | null;
  entity_type: MondayEntityType | null;
  entity_id: string | null;
  entity_label: string | null;
  detail: string;
}

export interface ImportPlan {
  board_key: MondayBoardKey;
  monday_board_id: string;
  canonical_key_kind: CanonicalKeyKind;
  items_seen: number;
  matched: number;
  already_linked: number;
  ambiguous: number;
  unmatched: number;
  conflicts: number;
  items: ItemPlan[];
  /** The subset `--import-links` would write. Never includes an ambiguity. */
  writable: ItemPlan[];
}

export interface PlanOptions {
  boardKey: MondayBoardKey;
  mondayBoardId: string;
  kind: CanonicalKeyKind;
  preferColumns?: string[];
  columnTitles?: Map<string, string>;
}

/**
 * Resolves each item to at most one portal record and classifies it.
 *
 * The classification is what makes this safe to run against a live board: only
 * `match` items are writable, and a record that is already linked somewhere
 * else, or an item that two records both claim, is reported as a conflict for a
 * person rather than silently repointed.
 */
export function planImport(items: MondayItem[], index: PortalIndex, options: PlanOptions): ImportPlan {
  const plans: ItemPlan[] = [];
  const claimedEntities = new Map<string, string>();

  for (const item of items) {
    const candidates = extractCandidateKeys(item, options.kind, {
      preferColumns: options.preferColumns,
      columnTitles: options.columnTitles,
    });

    const hits: { key: string; source: string; record: PortalRecord }[] = [];
    for (const candidate of candidates) {
      for (const record of index.byKey.get(candidate.key) ?? []) {
        hits.push({ key: candidate.key, source: candidate.source, record });
      }
    }

    const base = { monday_item_id: item.id, item_name: item.name ?? "" };

    if (hits.length === 0) {
      plans.push({
        ...base,
        outcome: "unmatched",
        canonical_key: candidates[0]?.key ?? null,
        key_source: candidates[0]?.source ?? null,
        entity_type: null,
        entity_id: null,
        entity_label: null,
        detail: candidates.length === 0
          ? `No ${options.kind.replace(/_/g, " ")} found on this item`
          : `No portal record matches ${candidates.map((candidate) => candidate.key).join(", ")}`,
      });
      continue;
    }

    const distinct = [...new Map(hits.map((hit) => [hit.record.entityId, hit])).values()];
    if (distinct.length > 1) {
      plans.push({
        ...base,
        outcome: "ambiguous",
        canonical_key: null,
        key_source: null,
        entity_type: null,
        entity_id: null,
        entity_label: null,
        detail: `Matches ${distinct.length} portal records: ${distinct.map((hit) => hit.record.label).join(", ")}`,
      });
      continue;
    }

    const hit = distinct[0];
    const existingForEntity = index.linkedEntity.get(hit.record.entityId);
    const existingForItem = index.linkedItem.get(item.id);
    const shared = {
      ...base,
      canonical_key: hit.key,
      key_source: hit.source,
      entity_type: hit.record.entityType,
      entity_id: hit.record.entityId,
      entity_label: hit.record.label,
    };

    if (existingForEntity && existingForEntity.mondayItemId === item.id) {
      plans.push({ ...shared, outcome: "already_linked", detail: `Already linked (${existingForEntity.syncState})` });
      continue;
    }
    if (existingForEntity) {
      plans.push({
        ...shared,
        outcome: "conflict",
        detail: `${hit.record.label} is already linked to Monday item ${existingForEntity.mondayItemId}`,
      });
      continue;
    }
    if (existingForItem) {
      plans.push({
        ...shared,
        outcome: "conflict",
        detail: `Monday item ${item.id} is already claimed by ${existingForItem.entityType} ${existingForItem.entityId}`,
      });
      continue;
    }
    const alreadyClaimed = claimedEntities.get(hit.record.entityId);
    if (alreadyClaimed) {
      plans.push({
        ...shared,
        outcome: "conflict",
        detail: `Monday items ${alreadyClaimed} and ${item.id} both point at ${hit.record.label}`,
      });
      continue;
    }

    claimedEntities.set(hit.record.entityId, item.id);
    plans.push({ ...shared, outcome: "match", detail: `Matched on ${hit.key} from ${hit.source}` });
  }

  // A record that a later item turned into a conflict must not stay writable.
  const conflictedEntities = new Set(plans.filter((plan) => plan.outcome === "conflict").map((plan) => plan.entity_id));
  for (const plan of plans) {
    if (plan.outcome === "match" && plan.entity_id && conflictedEntities.has(plan.entity_id)) {
      plan.outcome = "conflict";
      plan.detail = `Another Monday item also points at ${plan.entity_label}`;
    }
  }

  const count = (outcome: ItemOutcome) => plans.filter((plan) => plan.outcome === outcome).length;
  return {
    board_key: options.boardKey,
    monday_board_id: options.mondayBoardId,
    canonical_key_kind: options.kind,
    items_seen: items.length,
    matched: count("match"),
    already_linked: count("already_linked"),
    ambiguous: count("ambiguous"),
    unmatched: count("unmatched"),
    conflicts: count("conflict"),
    items: plans,
    writable: plans.filter((plan) => plan.outcome === "match"),
  };
}

/** A short, human-readable summary for the terminal and the run record. */
export function summarizePlan(plan: ImportPlan): string {
  return [
    `board ${plan.board_key} (${plan.monday_board_id}) keyed on ${plan.canonical_key_kind.replace(/_/g, " ")}`,
    `${plan.items_seen} items`,
    `${plan.matched} ready to link`,
    `${plan.already_linked} already linked`,
    `${plan.ambiguous} ambiguous`,
    `${plan.unmatched} unmatched`,
    `${plan.conflicts} conflicts`,
  ].join(" · ");
}
