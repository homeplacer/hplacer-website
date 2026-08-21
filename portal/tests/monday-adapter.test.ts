import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  MondayWriteRefused,
  assertReadOnlyDocument,
  createMondayClient,
  fetchBoardItems,
  type MondayItem,
} from "../src/integrations/monday-client.ts";
import { MondayToken, redact, staticTokenSource } from "../src/integrations/monday-credentials.ts";
import { buildPortalIndex, extractCandidateKeys, planImport, summarizePlan } from "../src/integrations/monday-discovery.ts";
import { createHarness, type Harness } from "./harness.ts";

const SECRET = "eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjEyMzQ1Njc4OX0.super-secret-signature-value";

describe("credential handling", () => {
  it("never renders the token, however it is stringified", () => {
    const token = new MondayToken(SECRET);
    assert.equal(String(token), "***");
    assert.equal(`${token}`, "***");
    assert.equal(JSON.stringify({ token }), '{"token":"***"}');
    assert.equal(JSON.stringify([token]), '["***"]');
    assert.ok(!JSON.stringify({ token }).includes("super-secret"));
  });

  it("hands the raw value over only when explicitly asked", () => {
    const token = new MondayToken(SECRET);
    assert.equal(token.authorizationHeader(), SECRET);
  });

  it("redacts itself out of arbitrary text", () => {
    const token = new MondayToken(SECRET);
    assert.equal(token.redact(`Authorization: ${SECRET} failed`), "Authorization: *** failed");
  });

  it("redacts anything that looks like a token, even one it has not seen", () => {
    assert.ok(!redact(`bearer ${SECRET}`).includes("super-secret"));
    assert.equal(redact("Authorization: abc123"), "Authorization: ***");
    assert.equal(redact("security add-generic-password -w hunter2"), "security add-generic-password -w ***");
  });

  it("refuses an empty token rather than sending a blank header", () => {
    assert.throws(() => new MondayToken("   "), /empty/);
  });
});

describe("read-only enforcement", () => {
  it("accepts a query", () => {
    assert.doesNotThrow(() => assertReadOnlyDocument("query Boards { boards { id } }"));
  });

  it("refuses a mutation", () => {
    assert.throws(() => assertReadOnlyDocument("mutation { create_item(board_id: 1) { id } }"), MondayWriteRefused);
    assert.throws(() => assertReadOnlyDocument("  MUTATION Foo { x }"), MondayWriteRefused);
    assert.throws(() => assertReadOnlyDocument("query A { a }\nmutation B { b }"), MondayWriteRefused);
  });

  it("refuses a subscription", () => {
    assert.throws(() => assertReadOnlyDocument("subscription { events { id } }"), MondayWriteRefused);
  });

  it("is not fooled by a comment or a string literal", () => {
    assert.doesNotThrow(() => assertReadOnlyDocument("# a mutation would go here\nquery A { a }"));
    assert.doesNotThrow(() => assertReadOnlyDocument('query A { search(term: "mutation") { id } }'));
  });

  it("blocks a mutation at the client, before any network call", async () => {
    let called = false;
    const client = createMondayClient(staticTokenSource(SECRET), {
      fetcher: async () => {
        called = true;
        return new Response("{}");
      },
    });
    await assert.rejects(client.query("mutation { change_column_value { id } }"), MondayWriteRefused);
    assert.equal(called, false, "nothing left the process");
  });

  it("says out loud that it is read-only, without naming the secret", () => {
    const client = createMondayClient(staticTokenSource(SECRET, "macOS Keychain (service x, account y)"));
    assert.match(client.describe(), /read-only/);
    assert.match(client.describe(), /Keychain/);
    assert.ok(!client.describe().includes("super-secret"));
  });

  it("keeps the token out of an API error message", async () => {
    const client = createMondayClient(staticTokenSource(SECRET), {
      fetcher: async () => new Response(`denied for token ${SECRET}`, { status: 401 }),
    });
    await assert.rejects(client.query("query A { a }"), (error: Error) => {
      assert.ok(!error.message.includes("super-secret"), error.message);
      assert.match(error.message, /401/);
      return true;
    });
  });

  it("sends the token as the Authorization header and pages through items", async () => {
    const pages: MondayItem[][] = [
      [{ id: "1", name: "A", column_values: [] }],
      [{ id: "2", name: "B", column_values: [] }],
    ];
    let call = 0;
    let sawAuth = "";
    const client = createMondayClient(staticTokenSource(SECRET), {
      fetcher: async (_input, init) => {
        sawAuth = new Headers(init?.headers).get("Authorization") ?? "";
        const items = pages[call] ?? [];
        const cursor = call < pages.length - 1 ? `cursor-${call}` : null;
        call += 1;
        return new Response(JSON.stringify({ data: { boards: [{ id: "9", name: "Homes", items_page: { cursor, items } }] } }));
      },
    });

    const result = await fetchBoardItems(client, "9", { pageSize: 1 });
    assert.equal(sawAuth, SECRET);
    assert.deepEqual(result.items.map((item) => item.id), ["1", "2"]);
    assert.equal(result.board.name, "Homes");
  });
});

describe("mapping Monday items to portal records", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  const item = (id: string, name: string, columns: Record<string, string> = {}): MondayItem => ({
    id,
    name,
    column_values: Object.entries(columns).map(([key, text]) => ({ id: key, text })),
  });

  it("reads a serial number out of a column or an item name", () => {
    const found = extractCandidateKeys(item("1", "Whitfield set", { serial: "CAV2026NC114772A" }), "serial_number");
    assert.equal(found[0].key, "CAV2026NC114772A");
    assert.match(found[0].source, /column:serial/);

    const fromName = extractCandidateKeys(item("2", "CLT2025TN881204Z — Pruitt"), "serial_number");
    assert.equal(fromName[0].key, "CLT2025TN881204Z");
  });

  it("trusts only the named column when one is given", () => {
    const withPreference = extractCandidateKeys(
      item("1", "CLT2025TN881204Z", { serial: "CAV2026NC114772A" }),
      "serial_number",
      { preferColumns: ["serial"] },
    );
    assert.deepEqual(withPreference.map((entry) => entry.key), ["CAV2026NC114772A"]);
  });

  it("holds a VIN to seventeen characters", () => {
    assert.deepEqual(
      extractCandidateKeys(item("1", "DT-01", { vin: "1FVACWDT0LHLR2201" }), "vin").map((entry) => entry.key),
      ["1FVACWDT0LHLR2201"],
    );
    assert.equal(extractCandidateKeys(item("2", "DT-01", { vin: "TOOSHORT" }), "vin").length, 0);
  });

  it("plans a clean import", async () => {
    const index = await buildPortalIndex(harness.db, "homes", "serial_number");
    const plan = planImport(
      [
        item("101", "Whitfield", { serial: "CAV2026NC114772A" }),
        item("102", "Rocketman", { serial: "CLT2026TN903318X" }),
      ],
      index,
      { boardKey: "homes", mondayBoardId: "1000000001", kind: "serial_number" },
    );
    // hom_a1 is already linked to 2000000011 in the seed.
    assert.equal(plan.items_seen, 2);
    assert.equal(plan.matched, 1);
    assert.equal(plan.conflicts, 1);
    assert.equal(plan.writable.length, 1);
    assert.equal(plan.writable[0].entity_id, "hom_a2");
    assert.match(summarizePlan(plan), /board homes/);
  });

  it("reports an item it cannot place instead of inventing one", async () => {
    const index = await buildPortalIndex(harness.db, "homes", "serial_number");
    const plan = planImport([item("103", "Some other home", { serial: "ZZZ9999NOTOURS" })], index, {
      boardKey: "homes",
      mondayBoardId: "1000000001",
      kind: "serial_number",
    });
    assert.equal(plan.unmatched, 1);
    assert.equal(plan.writable.length, 0);
    assert.match(plan.items[0].detail, /No portal record matches/);
  });

  it("refuses to write when two items claim the same record", async () => {
    const index = await buildPortalIndex(harness.db, "homes", "serial_number");
    const plan = planImport(
      [item("201", "Rocketman", { serial: "CLT2026TN903318X" }), item("202", "Rocketman duplicate", { serial: "CLT2026TN903318X" })],
      index,
      { boardKey: "homes", mondayBoardId: "1000000001", kind: "serial_number" },
    );
    assert.equal(plan.writable.length, 0, "an ambiguity is never written");
    assert.equal(plan.conflicts, 2);
  });

  it("notices a record already linked to a different Monday item", async () => {
    const index = await buildPortalIndex(harness.db, "homes", "serial_number");
    const plan = planImport([item("999", "Whitfield", { serial: "CAV2026NC114772A" })], index, {
      boardKey: "homes",
      mondayBoardId: "1000000001",
      kind: "serial_number",
    });
    assert.equal(plan.conflicts, 1);
    assert.match(plan.items[0].detail, /already linked to Monday item 2000000011/);
  });

  it("recognises an unchanged link rather than rewriting it", async () => {
    const index = await buildPortalIndex(harness.db, "homes", "serial_number");
    const plan = planImport([item("2000000011", "Whitfield", { serial: "CAV2026NC114772A" })], index, {
      boardKey: "homes",
      mondayBoardId: "1000000001",
      kind: "serial_number",
    });
    assert.equal(plan.already_linked, 1);
    assert.equal(plan.writable.length, 0);
  });

  it("keys equipment on the VIN the board is configured for", async () => {
    const index = await buildPortalIndex(harness.db, "equipment", "vin");
    const plan = planImport(
      [
        item("301", "DT-01", { vin: "1FVACWDT0LHLR2201" }),
        item("302", "PK-01", { vin: "1FT8W2BT4PEC55011" }),
        item("303", "EX-01", { serial: "DR135G21008841" }),
      ],
      index,
      { boardKey: "equipment", mondayBoardId: "1000000002", kind: "vin" },
    );
    // DT-01 is already linked in the seed; PK-01 is free; EX-01 has no VIN.
    assert.equal(plan.writable.length, 1);
    assert.equal(plan.writable[0].entity_label, "PK-01");
    assert.equal(plan.unmatched, 1);
  });
});
