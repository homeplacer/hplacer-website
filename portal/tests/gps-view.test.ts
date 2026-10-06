import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHarness, type Harness } from "./harness.ts";

describe("manager GPS phone view", () => {
  let h: Harness;
  beforeEach(async () => { h = await createHarness(); });
  afterEach(() => h.close());

  async function add(id: string, time: string | null, lat: number | null = 33, lon: number | null = -79, name = "Test tracker") {
    await h.db.prepare(`INSERT INTO gps_devices
      (device_id, provider_name, reported_at, latitude, longitude, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, name, time, lat, lon, new Date().toISOString()).run();
  }

  it("restricts the page and entry link to fleet managers", async () => {
    const employee = await h.db.prepare("SELECT id, email FROM employees WHERE role='employee' LIMIT 1").first<{ id: string; email: string }>();
    assert.ok(employee);
    await h.db.prepare("DELETE FROM employee_role_grants WHERE employee_id=?").bind(employee.id).run();
    for (const role of ["employee", "billing"]) {
      await h.db.prepare("UPDATE employees SET role=? WHERE id=?").bind(role, employee.id).run();
      assert.equal((await h.request("/equipment-gps", { as: employee.email })).status, 403);
      assert.doesNotMatch(await (await h.request("/equipment", { as: employee.email })).text(), /href="\/equipment-gps"/);
    }
    assert.match(await (await h.request("/equipment", { as: "brandon@hplacer.com" })).text(), /href="\/equipment-gps"/);
    const page = await h.request("/equipment-gps", { as: "brandon@hplacer.com" });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-store, private");
    assert.match(page.headers.get("content-security-policy")!, /default-src 'none'/);
    const body = await page.text();
    assert.match(body, /Not checked yet/);
    assert.match(body, /No tracker readings have been saved yet/);
  });

  it("escapes tracker labels and only makes map links for valid coordinate pairs", async () => {
    await add("safe", "2026-01-01T12:00:00Z", 33, -79, '<img src=x onerror="alert(1)">');
    await add("invalid", null, 91, -79);
    await add("partial", null, null, -79);
    const body = await (await h.request("/equipment-gps", { as: "brandon@hplacer.com" })).text();
    assert.match(body, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.doesNotMatch(body, /<img src=x/);
    assert.equal((body.match(/https:\/\/www.google.com\/maps\/search\//g) ?? []).length, 1);
    assert.match(body, /query=33%2C-79/);
    assert.match(body, /rel="noopener noreferrer external"/);
    assert.match(body, /Location unavailable/);
    assert.match(body, /Not linked to a portal machine/);
    assert.doesNotMatch(body, /<iframe|<script/);
  });

  it("separates old, unknown and future reports from the successful API check", async () => {
    await add("old", "2020-01-01T12:00:00Z");
    await add("unknown", null);
    await add("future", new Date(Date.now() + 86400000).toISOString());
    await add("recent", new Date(Date.now() - 3600000).toISOString());
    await h.db.prepare("UPDATE gps_devices SET asset_id='ast_ex1' WHERE device_id='old'").run();
    await h.db.prepare("INSERT INTO gps_sync_state (id,last_success_at,device_count) VALUES ('landairsea',?,4)").bind(new Date().toISOString()).run();
    const body = await (await h.request("/equipment-gps", { as: "brandon@hplacer.com" })).text();
    assert.match(body, /Older than 24 hours/);
    assert.match(body, /Report time unknown/);
    assert.match(body, /Report time is in the future/);
    assert.match(body, /Reported within 24 hours/);
    assert.match(body, /Jan 1, 2020, 7:00 AM EST/);
    assert.match(body, /Last successful API check:/);
    assert.match(body, /does not mean every tracker has sent a new location/);
    assert.match(body, /href="\/equipment\/EX-01"/);
    assert.match(body, /Tracker label: Test tracker/);
  });
});

describe("manual GPS checks", () => {
  it("requires manager access and same-origin POST and leaves disabled polling inert", async () => {
    const h = await createHarness();
    try {
      const employee = await h.db.prepare("SELECT email FROM employees WHERE role='employee' LIMIT 1").first<{email:string}>();
      assert.ok(employee);
      assert.equal((await h.request("/api/equipment-gps/refresh", {method:"POST",as:employee.email,headers:{Origin:"http://localhost:8788"}})).status,403);
      assert.equal((await h.request("/api/equipment-gps/refresh", {method:"POST",as:"brandon@hplacer.com",headers:{Origin:"https://other.example"}})).status,403);
      const response = await h.request("/api/equipment-gps/refresh", {method:"POST",as:"brandon@hplacer.com",headers:{Origin:"http://localhost:8788"}});
      assert.equal(response.headers.get("location"),"/equipment-gps?check=disabled");
      assert.equal((await h.db.prepare("SELECT COUNT(*) AS n FROM gps_devices").first<{n:number}>())?.n,0);
    } finally {h.close();}
  });
});
