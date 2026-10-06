import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchTrackerPositions, parseTrackerPositions } from "../src/integrations/landairsea.ts";
const credentials = { clientToken: "test-token", username: "test-account", password: "test-password" };
const device = { DeviceId: "tracker-1", Latitude: 33.8, Longitude: -78.9, LastLocationTimestamp: "2026-09-17T12:00:00Z", Speed_kmh: 0, Voltage: -1 };
function payload(devices: unknown[] = [device]) { return { message: { result: true }, DeviceDetails: devices }; }
describe("read-only LandAirSea tracking client", () => {
  it("preserves old observation time and treats unavailable voltage as unknown", () => {
    const [position] = parseTrackerPositions(payload());
    assert.equal(position.reportedAt, "2026-09-17T12:00:00.000Z");
    assert.equal(position.voltage, null);
    assert.equal(position.speedKmh, 0);
  });
  it("does not invent a timezone or a position from partial coordinates", () => {
    const [position] = parseTrackerPositions(payload([{ ...device, LastLocationTimestamp: "9/17/2026 12:00:00", Longitude: null }]));
    assert.equal(position.reportedAt, null);
    assert.equal(position.latitude, null);
    assert.equal(position.longitude, null);
  });
  it("rejects provider failure, duplicate IDs, and invalid coordinates", () => {
    assert.throws(() => parseTrackerPositions({ message: { result: false }, DeviceDetails: [] }));
    assert.throws(() => parseTrackerPositions(payload([device, device])));
    assert.equal(parseTrackerPositions(payload([{ ...device, Latitude: 500 }]))[0].latitude, null);
  });
  it("uses only the documented read endpoint and never puts secrets in a URL", async () => {
    await fetchTrackerPositions(credentials, async (url, init) => {
      assert.equal(url, "https://gateway.landairsea.com/Track/MyDevices");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.deepEqual(JSON.parse(String(init?.body)), credentials);
      assert.ok(init?.signal);
      return Response.json(payload());
    });
  });
  it("does not leak upstream errors or echo bodies", async () => {
    await assert.rejects(fetchTrackerPositions(credentials, async () => { throw new Error(credentials.password); }), { message: "GPS provider connection failed" });
    await assert.rejects(fetchTrackerPositions(credentials, async () => new Response(credentials.clientToken, { status: 403 })), { message: "GPS provider request failed" });
    await assert.rejects(fetchTrackerPositions(credentials, async () => new Response(credentials.password)), { message: "GPS provider returned an invalid response" });
  });
  it("bounds response size and rejects missing credentials before networking", async () => {
    await assert.rejects(fetchTrackerPositions(credentials, async () => new Response("x".repeat(1_000_001))), { message: "GPS provider returned an invalid response" });
    await assert.rejects(fetchTrackerPositions({ ...credentials, password: "" }, async () => { assert.fail("must not connect"); }), { message: "GPS credentials are incomplete" });
  });
});

describe("live provider response format", () => {
  const live = (utctime: string) => ({ message: { result: true }, suspended: false, devicedetails: [{ deviceId: "test-device", latitude: 30, longitude: -80, utctime, usertime: "ignored local time", lastlocation: "address, not timestamp", speed_kmh: 0, voltage: 12 }] });
  it("reads lower-case fields and explicit UTC without using local time or address", () => {
    const [p] = parseTrackerPositions(live("4/13/2026 7:45:23 PM"));
    assert.equal(p.reportedAt, "2026-04-13T19:45:23.000Z");
    assert.equal(p.latitude, 30);
    assert.equal(p.voltage, 12);
    assert.equal(parseTrackerPositions(live("4/13/2026 12:00:00 AM"))[0].reportedAt, "2026-04-13T00:00:00.000Z");
    assert.equal(parseTrackerPositions(live("4/13/2026 12:00:00 PM"))[0].reportedAt, "2026-04-13T12:00:00.000Z");
  });
  it("rejects suspended accounts and leaves malformed UTC observations unknown", () => {
    assert.throws(() => parseTrackerPositions({ ...live(""), suspended: true }));
    for (const date of ["2/30/2026 1:00:00 PM", "4/13/2026 0:00:00 AM", "4/13/2026 7:45:23", "invalid"]) {
      assert.equal(parseTrackerPositions(live(date))[0].reportedAt, null);
    }
  });
});
