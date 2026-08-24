import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";

export interface HomeWorkflowItem {
  item_key: "delivery_date";
  label: string;
  value_date: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
}

const ITEMS: Pick<HomeWorkflowItem, "item_key" | "label">[] = [
  { item_key: "delivery_date", label: "Delivery date" },
];

export async function homeWorkflow(db: Db, homeId: string): Promise<HomeWorkflowItem[]> {
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first<{ id: string }>();
  if (!home) throw notFound("Home not found");
  const rows = await db.prepare(`SELECT w.item_key, w.value_date, w.updated_at, e.display_name AS updated_by_name
    FROM home_workflow_items w JOIN employees e ON e.id = w.updated_by WHERE w.home_id = ?`)
    .bind(homeId).all<Omit<HomeWorkflowItem, "label">>();
  return ITEMS.map((item) => ({
    ...item,
    value_date: rows.results.find((row) => row.item_key === item.item_key)?.value_date ?? null,
    updated_at: rows.results.find((row) => row.item_key === item.item_key)?.updated_at ?? null,
    updated_by_name: rows.results.find((row) => row.item_key === item.item_key)?.updated_by_name ?? null,
  }));
}

export async function saveDeliveryDate(db: Db, homeId: string, employeeId: string, value: string | null): Promise<void> {
  const date = value?.trim() || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Delivery date must look like 2026-08-30");
  if (date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw badRequest("Choose a valid delivery date");
  }
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first<{ id: string }>();
  if (!home) throw notFound("Home not found");
  const timestamp = nowIso();
  await db.prepare(`INSERT INTO home_workflow_items (id, home_id, item_key, value_date, updated_by, created_at, updated_at)
    VALUES (?, ?, 'delivery_date', ?, ?, ?, ?)
    ON CONFLICT(home_id, item_key) DO UPDATE SET value_date = excluded.value_date,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(newId("hwf"), homeId, date, employeeId, timestamp, timestamp).run();
}
