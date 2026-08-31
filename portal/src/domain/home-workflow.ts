import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";

export type HomeWorkflowKind = "date" | "boolean" | "choice";
export type HomeWorkflowKey =
  | "delivery_date" | "delivered" | "scheduled_install_date" | "install_complete"
  | "house_numbers_installed" | "permit_received" | "meter_set" | "inspection_scheduled"
  | "inspection_date" | "final_inspection_passed" | "electric_ordered" | "utility_type"
  | "foundation_certificate_received" | "home_inspection" | "skirting_framing_complete"
  | "skirting_on" | "trim_out_complete" | "hvac_scheduled" | "hvac_installed"
  | "sod_rock_installed" | "driveway_installed" | "mailbox_set";

export interface WorkflowHistoryRow {
  id: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_name: string;
}

export interface HomeWorkflowItem {
  item_key: HomeWorkflowKey;
  label: string;
  kind: HomeWorkflowKind;
  value_date: string | null;
  value_boolean: number | null;
  value_text: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  history: WorkflowHistoryRow[];
}

export const HOME_WORKFLOW_ITEMS: Pick<HomeWorkflowItem, "item_key" | "label" | "kind">[] = [
  { item_key: "delivery_date", label: "Estimated delivery date", kind: "date" },
  { item_key: "delivered", label: "Delivered", kind: "boolean" },
  { item_key: "scheduled_install_date", label: "Scheduled install date", kind: "date" },
  { item_key: "install_complete", label: "Install complete", kind: "boolean" },
  { item_key: "house_numbers_installed", label: "House numbers installed", kind: "boolean" },
  { item_key: "permit_received", label: "Permit received", kind: "boolean" },
  { item_key: "meter_set", label: "Meter set", kind: "boolean" },
  { item_key: "inspection_scheduled", label: "Inspection scheduled", kind: "boolean" },
  { item_key: "inspection_date", label: "Inspection date", kind: "date" },
  { item_key: "final_inspection_passed", label: "Final inspection passed", kind: "boolean" },
  { item_key: "electric_ordered", label: "Electric ordered", kind: "boolean" },
  { item_key: "utility_type", label: "Sewer or septic", kind: "choice" },
  { item_key: "foundation_certificate_received", label: "Foundation certificate received", kind: "boolean" },
  { item_key: "home_inspection", label: "Home inspection", kind: "boolean" },
  { item_key: "skirting_framing_complete", label: "Skirting framing complete", kind: "boolean" },
  { item_key: "skirting_on", label: "Skirting on", kind: "boolean" },
  { item_key: "trim_out_complete", label: "Trim-out complete", kind: "boolean" },
  { item_key: "hvac_scheduled", label: "HVAC scheduled", kind: "boolean" },
  { item_key: "hvac_installed", label: "HVAC installed", kind: "boolean" },
  { item_key: "sod_rock_installed", label: "Sod / rock installed", kind: "boolean" },
  { item_key: "driveway_installed", label: "Driveway installed", kind: "boolean" },
  { item_key: "mailbox_set", label: "Mailbox set", kind: "boolean" },
];

interface StoredWorkflowRow {
  item_key: HomeWorkflowKey;
  value_date: string | null;
  value_boolean: number | null;
  value_text: string | null;
  updated_at: string;
  updated_by_name: string;
}

export async function homeWorkflow(db: Db, homeId: string): Promise<HomeWorkflowItem[]> {
  const home = await db.prepare("SELECT id, delivered_on, setup_completed_on, final_inspection_on FROM homes WHERE id = ?")
    .bind(homeId).first<{ id: string; delivered_on: string | null; setup_completed_on: string | null; final_inspection_on: string | null }>();
  if (!home) throw notFound("Home not found");
  const [stored, history] = await Promise.all([
    db.prepare(`SELECT w.item_key, w.value_date, w.value_boolean, w.value_text, w.updated_at, e.display_name AS updated_by_name
      FROM home_workflow_items w JOIN employees e ON e.id = w.updated_by WHERE w.home_id = ?`)
      .bind(homeId).all<StoredWorkflowRow>(),
    db.prepare(`SELECT h.id, h.item_key, h.old_value, h.new_value, h.changed_at, e.display_name AS changed_by_name
      FROM home_workflow_history h JOIN employees e ON e.id = h.changed_by
      WHERE h.home_id = ? ORDER BY h.changed_at DESC, h.id DESC`).bind(homeId)
      .all<WorkflowHistoryRow & { item_key: HomeWorkflowKey }>(),
  ]);
  const derived: Partial<Record<HomeWorkflowKey, number>> = {
    delivered: home.delivered_on ? 1 : 0,
    install_complete: home.setup_completed_on ? 1 : 0,
    final_inspection_passed: home.final_inspection_on ? 1 : 0,
  };
  return HOME_WORKFLOW_ITEMS.map((definition) => {
    const row = stored.results.find((candidate) => candidate.item_key === definition.item_key);
    return {
      ...definition,
      value_date: row?.value_date ?? null,
      value_boolean: row?.value_boolean ?? derived[definition.item_key] ?? null,
      value_text: row?.value_text ?? null,
      updated_at: row?.updated_at ?? null,
      updated_by_name: row?.updated_by_name ?? null,
      history: history.results.filter((entry) => entry.item_key === definition.item_key),
    };
  });
}

export async function saveHomeWorkflowItem(db: Db, homeId: string, employeeId: string, itemKey: string, rawValue: string | null): Promise<void> {
  const definition = HOME_WORKFLOW_ITEMS.find((item) => item.item_key === itemKey);
  if (!definition) throw badRequest("Unknown home checklist item");
  if (!(await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first())) throw notFound("Home not found");

  let date: string | null = null;
  let boolean: number | null = null;
  let text: string | null = null;
  const value = rawValue?.trim() || null;
  if (definition.kind === "date") date = validDate(value);
  else if (definition.kind === "boolean") {
    if (value !== "yes" && value !== "no") throw badRequest(`Choose yes or no for ${definition.label}`);
    boolean = value === "yes" ? 1 : 0;
  } else {
    if (value !== "septic" && value !== "sewer") throw badRequest("Choose sewer or septic");
    text = value;
  }

  const current = await db.prepare("SELECT value_date, value_boolean, value_text FROM home_workflow_items WHERE home_id = ? AND item_key = ?")
    .bind(homeId, itemKey).first<{ value_date: string | null; value_boolean: number | null; value_text: string | null }>();
  const oldValue = serialized(current?.value_date ?? null, current?.value_boolean ?? null, current?.value_text ?? null);
  const newValue = serialized(date, boolean, text);
  if (current && oldValue === newValue) return;

  const timestamp = nowIso();
  await db.batch([
    db.prepare(`INSERT INTO home_workflow_items
      (id, home_id, item_key, value_date, value_boolean, value_text, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(home_id, item_key) DO UPDATE SET value_date = excluded.value_date,
        value_boolean = excluded.value_boolean, value_text = excluded.value_text,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(newId("hwf"), homeId, itemKey, date, boolean, text, employeeId, timestamp, timestamp),
    db.prepare(`INSERT INTO home_workflow_history
      (id, home_id, item_key, old_value, new_value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(newId("hwh"), homeId, itemKey, oldValue, newValue, employeeId, timestamp),
  ]);
}

function validDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest("Date must look like 2026-08-30");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw badRequest("Choose a valid date");
  return value;
}

function serialized(date: string | null, boolean: number | null, text: string | null): string | null {
  if (date !== null) return date;
  if (boolean !== null) return boolean === 1 ? "yes" : "no";
  return text;
}
