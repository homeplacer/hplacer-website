import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHarness } from "./harness.ts";
import { runConfiguredGpsSync } from "../src/integrations/landairsea-sync.ts";
const position = { DeviceId: "tracker-test", name: "  Test\u0000 excavator  ", Latitude: 33, Longitude: -79, LastLocationTimestamp: "2026-09-17T12:00:00Z" };
const response = (device = position) => Response.json({ message: { result: true }, DeviceDetails: [device] });
describe("GPS snapshots", () => {
  it("stays off by default", async () => {
    const h = await createHarness();
    try { assert.deepEqual(await runConfiguredGpsSync(h.env, async () => { assert.fail("must not fetch"); }), { enabled: false, devices: 0 }); } finally { h.close(); }
  });
  it("preserves mapping, equipment status and last good positions on failure or old data", async () => {
    const h = await createHarness();
    Object.assign(h.env, { GPS_SYNC_ENABLED: "true", LANDAIRSEA_CLIENT_TOKEN: "test", LANDAIRSEA_USERNAME: "test", LANDAIRSEA_PASSWORD: "test" });
    try {
      const asset = await h.db.prepare("SELECT * FROM assets WHERE id='ast_ex1'").first();
      await runConfiguredGpsSync(h.env, async () => response());
      await h.db.prepare("UPDATE gps_devices SET asset_id='ast_ex1' WHERE device_id='tracker-test'").run();
      await runConfiguredGpsSync(h.env, async () => response({ ...position, Latitude: 35, LastLocationTimestamp: "2026-09-16T12:00:00Z" }));
      await assert.rejects(runConfiguredGpsSync(h.env, async () => new Response("error", { status: 503 })));
      const row = await h.db.prepare("SELECT * FROM gps_devices WHERE device_id='tracker-test'").first();
      assert.equal(row?.asset_id, "ast_ex1"); assert.equal(row?.latitude, 33);
      assert.equal(row?.provider_name, "Test excavator");
      assert.deepEqual(await h.db.prepare("SELECT * FROM assets WHERE id='ast_ex1'").first(), asset);
      const manager = await h.request("/api/equipment-gps", { as: "brandon@hplacer.com" });
      assert.equal(manager.status, 200); assert.equal(manager.headers.get("cache-control"), "private, no-store");
      const body = await manager.json() as { devices: { provider_name: string | null }[] };
      assert.equal(body.devices[0].provider_name, "Test excavator");
      const employee = await h.db.prepare("SELECT email FROM employees WHERE role='employee' LIMIT 1").first<{email:string}>();
      assert.ok(employee);
      assert.equal((await h.request("/api/equipment-gps", { as: employee.email })).status, 403);
    } finally { h.close(); }
  });
  it("refreshes provider labels without guessing or replacing equipment links", async () => {
    const h = await createHarness();
    Object.assign(h.env, { GPS_SYNC_ENABLED: "true", LANDAIRSEA_CLIENT_TOKEN: "test", LANDAIRSEA_USERNAME: "test", LANDAIRSEA_PASSWORD: "test" });
    try {
      await runConfiguredGpsSync(h.env, async () => response());
      const unlinked = await h.db.prepare("SELECT * FROM gps_devices WHERE device_id='tracker-test'").first();
      assert.equal(unlinked?.asset_id, null);
      await h.db.prepare("UPDATE gps_devices SET asset_id='ast_ex1' WHERE device_id='tracker-test'").run();
      await runConfiguredGpsSync(h.env, async () => response({ ...position, name: "Renamed excavator" }));
      const linked = await h.db.prepare("SELECT * FROM gps_devices WHERE device_id='tracker-test'").first();
      assert.equal(linked?.provider_name, "Renamed excavator");
      assert.equal(linked?.asset_id, "ast_ex1");
      const unnamed = { ...position, DeviceId: "unmapped-tracker", name: null };
      await runConfiguredGpsSync(h.env, async () => Response.json({ message: { result: true }, DeviceDetails: [unnamed] }));
      const missing = await h.db.prepare("SELECT * FROM gps_devices WHERE device_id='unmapped-tracker'").first();
      assert.equal(missing?.provider_name, null);
      assert.equal(missing?.asset_id, null);
    } finally { h.close(); }
  });
});
