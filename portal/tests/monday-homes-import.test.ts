import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchMondayHomesBoard,
  importMondayHomes,
  mondayHomesImportEnabled,
  type MondayHomeBoard,
  type MondayHomeItem,
} from "../src/integrations/monday-homes-import.ts";
import type { MondayClient } from "../src/integrations/monday-client.ts";
import { createHarness } from "./harness.ts";

const columns = [
  { id: "serial", title: "Serial #", type: "text" },
  { id: "address", title: "Address", type: "text" },
  { id: "stage", title: "Stage", type: "status" },
  { id: "sale", title: "Sale Type", type: "dropdown" },
];

function item(id: string, name: string, stage: string, serial: string | null, updatedAt = "2026-09-28T12:00:00Z"): MondayHomeItem {
  return {
    id,
    name,
    updated_at: updatedAt,
    group: { id: `group_${stage.toLowerCase()}`, title: stage },
    column_values: [
      { id: "serial", text: serial, value: serial ? JSON.stringify(serial) : null },
      { id: "address", text: name, value: JSON.stringify(name) },
      { id: "stage", text: stage, value: JSON.stringify({ label: stage }) },
      { id: "sale", text: "Retail", value: JSON.stringify({ ids: [1] }) },
    ],
  };
}

function board(items: MondayHomeItem[]): MondayHomeBoard {
  return { id: "18419219855", name: "HOMES ROSTER", columns, items };
}

describe("read-only Monday Homes Roster import", () => {
  it("stays off unless explicitly enabled", () => {
    assert.equal(mondayHomesImportEnabled({}), false);
    assert.equal(mondayHomesImportEnabled({ MONDAY_HOMES_IMPORT_ENABLED: "TRUE" }), false);
    assert.equal(mondayHomesImportEnabled({ MONDAY_HOMES_IMPORT_ENABLED: "true" }), true);
  });

  it("paginates all board items and asks for all column values without mutations", async () => {
    const requests: string[] = [];
    const client: MondayClient = {
      describe: () => "test source",
      async query<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
        requests.push(document);
        assert.doesNotMatch(document, /\bmutation\b/i);
        if (requests.length === 1) {
          assert.equal(variables?.boardId, "18419219855");
          return { boards: [{ id: "18419219855", name: "HOMES ROSTER", columns, items_page: { cursor: "next", items: [item("10", "10 Main St", "Active", "SN-10")] } }] } as T;
        }
        return { next_items_page: { cursor: null, items: [item("11", "11 Main St", "Pending", null)] } } as T;
      },
    };
    const fetched = await fetchMondayHomesBoard(client, "18419219855");
    assert.equal(fetched.items.length, 2);
    assert.deepEqual(fetched.columns.map((column) => column.title), ["Serial #", "Address", "Stage", "Sale Type"]);
    assert.match(requests[0], /column_values\s*\{\s*id\s+text\s+value\s+type/s);
    assert.match(requests[0], /group\s*\{\s*id\s+title\s*\}/s);
  });

  it("imports only the four approved stages, keeps every source column, and is idempotent", async () => {
    const harness = await createHarness();
    try {
      const initial = board([
        item("101", "105 Pepe Court, Conway SC 29527", "Active", "HOME-101"),
        item("102", "5538 Daffodil, Conway SC 29527", "Sold", "HOME-102"),
        item("103", "1344 Rabbit Ln., Conway SC 29526", "Closed", "HOME-103"),
        item("104", "TBD Seletha Lane", "Pending", null),
        item("105", "1327 Rabbit Lane", "Delivered", "HOME-105"),
      ]);
      const first = await importMondayHomes(harness.db, initial, new Date("2026-09-28T13:00:00Z"));
      assert.deepEqual(first, {
        enabled: true, boardItems: 5, eligible: 4, created: 4, updated: 0,
        unchanged: 0, excluded: 1, conflicts: 0,
      });
      const homes = await harness.db.prepare("SELECT * FROM homes WHERE monday_item_id IN ('101', '102', '103', '104') ORDER BY monday_item_id").all<Record<string, unknown>>();
      assert.equal(homes.results.length, 4);
      assert.equal(homes.results[0].monday_stage, "active");
      assert.equal(homes.results[0].site_address, "105 Pepe Court, Conway SC 29527");
      assert.match(String(homes.results[3].serial_number), /^PENDING-MON-104$/);
      const source = JSON.parse(String(homes.results[0].monday_source_json)) as { columns: { title: string }[] };
      assert.deepEqual(source.columns.map((column) => column.title), ["Serial #", "Address", "Stage", "Sale Type"]);

      const noChange = await importMondayHomes(harness.db, initial, new Date("2026-09-28T13:15:00Z"));
      assert.equal(noChange.created, 0);
      assert.equal(noChange.updated, 0);
      assert.equal(noChange.unchanged, 4);

      await harness.db.prepare("UPDATE homes SET status = 'installed' WHERE monday_item_id = '101'").run();
      const changed = board([
        item("101", "105 Pepe Court, Conway SC 29527", "Sold", "HOME-101", "2026-09-28T13:20:00Z"),
        item("102", "5538 Daffodil, Conway SC 29527", "Sold", "HOME-102"),
        item("103", "1344 Rabbit Ln., Conway SC 29526", "Closed", "HOME-103"),
        item("104", "TBD Seletha Lane", "Pending", "HOME-104"),
        // An out-of-scope row is not added until an approved stage is assigned.
        item("105", "1327 Rabbit Lane", "Delivered", "HOME-105"),
      ]);
      const update = await importMondayHomes(harness.db, changed, new Date("2026-09-28T13:30:00Z"));
      assert.equal(update.created, 0);
      assert.equal(update.updated, 2);
      assert.equal(update.excluded, 1);
      const preserved = await harness.db.prepare("SELECT status, monday_stage, serial_number FROM homes WHERE monday_item_id = '101'").first<{ status: string; monday_stage: string; serial_number: string }>();
      assert.equal(preserved?.status, "installed");
      assert.equal(preserved?.monday_stage, "sold");
      assert.equal(preserved?.serial_number, "HOME-101");
      const movedOut = await importMondayHomes(harness.db, board([
        item("101", "105 Pepe Court, Conway SC 29527", "Delivered", "HOME-101", "2026-09-28T13:40:00Z"),
        item("102", "5538 Daffodil, Conway SC 29527", "Sold", "HOME-102"),
        item("103", "1344 Rabbit Ln., Conway SC 29526", "Closed", "HOME-103"),
        item("104", "TBD Seletha Lane", "Pending", "HOME-104"),
      ]), new Date("2026-09-28T13:45:00Z"));
      assert.equal(movedOut.updated, 1);
      assert.equal(movedOut.excluded, 1);
      const movedStatus = await harness.db.prepare("SELECT monday_stage FROM homes WHERE monday_item_id = '101'").first<{ monday_stage: string }>();
      assert.equal(movedStatus?.monday_stage, "delivered");
    } finally {
      harness.close();
    }
  });

  it("refuses an empty or malformed source before marking records missing", async () => {
    const harness = await createHarness();
    try {
      await importMondayHomes(harness.db, board([item("201", "201 Main St", "Active", "HOME-201")]));
      await assert.rejects(importMondayHomes(harness.db, board([])), /empty/);
      await assert.rejects(importMondayHomes(harness.db, board([{ ...item("x", "Bad row", "Active", null), id: "not-numeric" }])), /numeric item id/);
      const row = await harness.db.prepare("SELECT monday_source_missing FROM homes WHERE monday_item_id = '201'").first<{ monday_source_missing: number }>();
      assert.equal(row?.monday_source_missing, 0);
    } finally {
      harness.close();
    }
  });
});
