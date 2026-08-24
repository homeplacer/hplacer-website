import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { listAssets } from "../src/domain/assets.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("verified fleet list and private equipment photos", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("keeps unresolved imported placeholders out of the main list and segregates them for review", async () => {
    await harness.db.prepare(`INSERT INTO asset_source_metadata
      (asset_id, source_file, source_reference, verification_status) VALUES ('ast_ex1', 'fleet.xlsx', 'generic row', 'needs_serial')`).run();
    assert.ok(!(await listAssets(harness.db)).some((asset) => asset.id === "ast_ex1"));
    assert.ok((await listAssets(harness.db, { verification: "review" })).some((asset) => asset.id === "ast_ex1"));
    const main = await (await harness.request("/equipment", { as: "dale@hplacer.com" })).text();
    assert.ok(!main.includes("EX-01 ·"));
    const review = await (await harness.request("/equipment?scope=review", { as: "dale@hplacer.com" })).text();
    assert.match(review, /EX-01 ·/);
    assert.match(review, /Source review/);
  });

  it("uploads an equipment photo privately and shows its protected thumbnail on the list", async () => {
    const body = new FormData();
    body.set("asset_id", "ast_ex2");
    body.set("redirect_to", "/equipment/EX-02");
    body.set("home_document_category", "equipment_photo");
    body.set("file", new File([new Uint8Array([1, 2, 3])], "excavator.jpg", { type: "image/jpeg" }));
    assert.equal((await harness.request("/api/documents/upload", { as: "dale@hplacer.com", method: "POST", body })).status, 303);
    const assets = await listAssets(harness.db);
    const asset = assets.find((item) => item.id === "ast_ex2");
    assert.ok(asset?.primary_photo_id);
    const page = await (await harness.request("/equipment", { as: "dale@hplacer.com" })).text();
    assert.match(page, new RegExp(`/api/documents/${asset!.primary_photo_id}/content`));
    assert.equal((await harness.request(`/api/documents/${asset!.primary_photo_id}/content`, { as: "dale@hplacer.com" })).status, 200);
  });

  it("shows a clean fallback and a dedicated photo manager without changing other documents", async () => {
    const list = await (await harness.request("/equipment", { as: "dale@hplacer.com" })).text();
    assert.match(list, /No photo/);
    const detail = await (await harness.request("/equipment/EX-02", { as: "dale@hplacer.com" })).text();
    assert.match(detail, /<h2>Equipment photo<\/h2>/);
    assert.match(detail, /Upload Equipment photo/);
  });
});
