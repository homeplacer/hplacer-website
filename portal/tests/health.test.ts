import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { handleRequest } from "../src/app.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("authenticated readiness", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => harness.close());

  it("checks the D1 schema and private R2 binding without returning record data", async () => {
    const response = await harness.request("/api/health/ready", { as: "dale@hplacer.com" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ready",
      checks: { database: "ok", objectStorage: "ok" },
    });
  });

  it("stays behind Access and active employee resolution", async () => {
    const response = await handleRequest(new Request("https://portal.hplacer.com/api/health/ready"), {
      ...harness.env,
      PORTAL_ENVIRONMENT: "production",
      ACCESS_TEAM_DOMAIN: "homeplacer",
      ACCESS_AUD: "aud",
    });
    assert.equal(response.status, 401);
  });

  it("returns not ready when a required binding or migration is absent", async () => {
    const withoutR2 = { ...harness.env, PORTAL_PHOTOS: undefined };
    const noBucket = await handleRequest(new Request("http://localhost:8788/api/health/ready"), withoutR2, {
      identity: { subject: "dev|ops", email: "ops@hplacer.com", method: "local_development" },
    });
    assert.equal(noBucket.status, 503);
    assert.deepEqual(await noBucket.json(), { status: "not_ready" });

    await harness.db.exec("DROP TABLE asset_insurance_cards;");
    const oldSchema = await harness.request("/api/health/ready");
    assert.equal(oldSchema.status, 503);
    assert.deepEqual(await oldSchema.json(), { status: "not_ready" });
  });
});
