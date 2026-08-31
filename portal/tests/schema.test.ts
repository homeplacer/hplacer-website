import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { migrationFiles } from "../dev/db.ts";
import type { SqliteDb } from "../src/platform/sqlite.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("schema", () => {
  let harness: Harness;
  let db: SqliteDb;

  before(async () => {
    harness = await createHarness();
    db = harness.db;
  });
  after(() => harness.close());

  it("applies every migration in order", async () => {
    const applied = await db.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{ name: string }>();
    assert.deepEqual(applied.results.map((row) => row.name), migrationFiles());
  });

  it("keeps quantity_on_hand in step with the movement ledger", async () => {
    const before = await db.prepare("SELECT quantity_on_hand FROM parts WHERE sku = 'ANC-4830'").first<{ quantity_on_hand: number }>();
    await db
      .prepare(
        `INSERT INTO inventory_movements (id, part_id, movement_type, quantity, recorded_by, created_at)
         VALUES ('mov_test1', 'prt_anchor', 'received', 25, 'emp_tara', '2026-08-21 09:00:00')`,
      )
      .run();
    const after = await db.prepare("SELECT quantity_on_hand FROM parts WHERE sku = 'ANC-4830'").first<{ quantity_on_hand: number }>();
    assert.equal(after?.quantity_on_hand, (before?.quantity_on_hand ?? 0) + 25);
  });

  it("requires a document to hang off at least one record", async () => {
    await assert.rejects(
      db
        .prepare(
          `INSERT INTO documents (id, document_type, storage_provider, storage_key, file_name, uploaded_by, created_at)
           VALUES ('doc_orphan', 'photo', 'r2', 'photos/x', 'x.jpg', 'emp_tara', '2026-08-21 09:00:00')`,
        )
        .run(),
      /CHECK constraint failed/,
    );
  });

  it("refuses a Drive document with no external URL", async () => {
    await assert.rejects(
      db
        .prepare(
          `INSERT INTO documents (id, document_type, storage_provider, storage_key, file_name, home_id, uploaded_by, created_at)
           VALUES ('doc_nourl', 'plat', 'google_drive', 'abc', 'x.pdf', 'hom_a1', 'emp_tara', '2026-08-21 09:00:00')`,
        )
        .run(),
      /CHECK constraint failed/,
    );
  });

  it("refuses an R2 document that carries a stored URL", async () => {
    await assert.rejects(
      db
        .prepare(
          `INSERT INTO documents (id, document_type, storage_provider, storage_key, external_url, file_name, home_id, uploaded_by, created_at)
           VALUES ('doc_url', 'photo', 'r2', 'photos/x', 'https://example.com/x.jpg', 'x.jpg', 'hom_a1', 'emp_tara', '2026-08-21 09:00:00')`,
        )
        .run(),
      /CHECK constraint failed/,
    );
  });

  it("deduplicates part compatibility rows across nullable columns", async () => {
    await db
      .prepare("INSERT INTO part_compatibility (id, part_id, asset_id, manufacturer, model) VALUES ('pc1', 'prt_filter', NULL, 'Deere', '135G')")
      .run();
    await assert.rejects(
      db
        .prepare("INSERT INTO part_compatibility (id, part_id, asset_id, manufacturer, model) VALUES ('pc2', 'prt_filter', NULL, 'Deere', '135G')")
        .run(),
      /UNIQUE constraint failed/,
    );
  });

  it("allows only one pre-use inspection per operator, machine, and day", async () => {
    const insert = (id: string, at: string) =>
      db
        .prepare(
          `INSERT INTO inspections (id, inspection_kind, status, asset_id, performed_by, performed_at, created_at)
           VALUES (?, 'daily_equipment', 'passed', 'ast_ex2', 'emp_dale', ?, ?)`,
        )
        .bind(id, at, at)
        .run();

    await insert("insp_day1", "2026-08-21 07:00:00");
    await assert.rejects(insert("insp_day1b", "2026-08-21 16:00:00"), /UNIQUE constraint failed/);
    // A different day, and a different operator on the same day, are both fine.
    await insert("insp_day2", "2026-08-22 07:00:00");
    await db
      .prepare(
        `INSERT INTO inspections (id, inspection_kind, status, asset_id, performed_by, performed_at, created_at)
         VALUES ('insp_other', 'daily_equipment', 'passed', 'ast_ex2', 'emp_marcus', '2026-08-21 07:30:00', '2026-08-21 07:30:00')`,
      )
      .run();
  });

  it("keeps the notification dedupe key unique per employee", async () => {
    const insert = (id: string) =>
      db
        .prepare(
          `INSERT INTO notifications (id, employee_id, category, title, body, dedupe_key, created_at)
           VALUES (?, 'emp_tara', 'inventory_low', 't', 'b', 'low_stock:prt_anchor', '2026-08-21 09:00:00')`,
        )
        .bind(id)
        .run();
    await insert("ntf_a");
    await assert.rejects(insert("ntf_b"), /UNIQUE constraint failed/);
  });
});
