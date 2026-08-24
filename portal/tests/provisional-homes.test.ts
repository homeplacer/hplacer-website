import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { canonicalKeyFor } from "../src/integrations/monday.ts";
import { getHome, missingHomeIdentity } from "../src/domain/homes.ts";
import { createHarness, jsonBody, type Harness } from "./harness.ts";

describe("provisional home identity", () => {
  let harness: Harness;
  beforeEach(async () => { harness = await createHarness(); });
  afterEach(() => harness.close());

  it("creates a home with every identity field unknown and lists exactly what is missing", async () => {
    const response = await harness.request("/api/homes", { as: "greg@hplacer.com", ...jsonBody({ job_id: "job_2601" }) });
    assert.equal(response.status, 201);
    const { id } = await response.json() as { id: string };
    const home = await getHome(harness.db, id);
    assert.ok(home?.serial_number.startsWith("PENDING-"));
    assert.equal(home?.identity_incomplete, 1);
    assert.deepEqual(missingHomeIdentity(home!), ["Serial number", "Make", "Model", "Year", "Section count", "HUD plate numbers"]);
    const page = await (await harness.request(`/homes/${id}`, { as: "greg@hplacer.com" })).text();
    assert.match(page, /Identity incomplete/);
    assert.match(page, /Missing: Serial number, Make, Model, Year, Section count, HUD plate numbers/);
    assert.match(page, /Edit home identity/);
  });

  it("allows later partial edits and clears the warning only when all identity fields exist", async () => {
    const created = await harness.request("/api/homes", { as: "greg@hplacer.com", ...jsonBody({ manufacturer: "Clayton" }) });
    const { id } = await created.json() as { id: string };
    await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ serial_number: "NEW12345", manufacturer: "Clayton", model: "Horizon" }) });
    let home = await getHome(harness.db, id);
    assert.deepEqual(missingHomeIdentity(home!), ["Year", "Section count", "HUD plate numbers"]);
    await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ serial_number: "NEW12345", manufacturer: "Clayton", model: "Horizon", model_year: 2026, section_count: 2, hud_label_numbers: "HUD-A / HUD-B" }) });
    home = await getHome(harness.db, id);
    assert.equal(home?.identity_incomplete, 0);
    assert.deepEqual(missingHomeIdentity(home!), []);
  });

  it("preserves validation, duplicate prevention, and supervisor-only editing", async () => {
    const created = await harness.request("/api/homes", { as: "greg@hplacer.com", ...jsonBody({}) });
    const { id } = await created.json() as { id: string };
    assert.equal((await harness.request(`/api/homes/${id}/identity`, { as: "dale@hplacer.com", ...jsonBody({ serial_number: "NOPE123" }) })).status, 403);
    assert.equal((await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ serial_number: "ABC" }) })).status, 400);
    assert.equal((await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ model_year: 20 }) })).status, 400);
    assert.equal((await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ section_count: 1.5 }) })).status, 400);
    assert.equal((await harness.request(`/api/homes/${id}/identity`, { as: "greg@hplacer.com", ...jsonBody({ serial_number: "CAV2026NC114772A" }) })).status, 409);
    await assert.rejects(canonicalKeyFor(harness.db, "home", id), /serial number before linking/);
  });

  it("still accepts and validates supplied identity during creation", async () => {
    const response = await harness.request("/api/homes", { as: "greg@hplacer.com", ...jsonBody({
      serial_number: "VALID-9000", manufacturer: "Champion", model: "Vista", model_year: 2026, section_count: 1, hud_label_numbers: "HUD-9000",
    }) });
    assert.equal(response.status, 201);
    const { id } = await response.json() as { id: string };
    assert.equal((await getHome(harness.db, id))?.identity_incomplete, 0);
  });
});
