import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { handleRequest } from "../src/app.ts";
import { recentAudit } from "../src/domain/audit.ts";
import { createHarness, form, identityFor, jsonBody, type Harness } from "./harness.ts";

describe("request pipeline", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = await createHarness();
  });

  it("refuses a request with no identity before it touches the database", async () => {
    const response = await handleRequest(new Request("https://portal.hplacer.com/homes"), {
      ...harness.env,
      PORTAL_ENVIRONMENT: "production",
      ACCESS_TEAM_DOMAIN: "homeplacer",
      ACCESS_AUD: "aud",
    });
    assert.equal(response.status, 401);
    assert.match(await response.text(), /Missing Cloudflare Access assertion/);
  });

  it("fails closed when the database is not bound", async () => {
    const response = await handleRequest(new Request("http://localhost:8788/"), {
      PORTAL_ENVIRONMENT: "development",
      PORTAL_DEV_IDENTITY: "ops@hplacer.com",
    } as never);
    assert.equal(response.status, 503);
  });

  it("turns away an identity with no employee record and logs the attempt", async () => {
    const response = await handleRequest(new Request("http://localhost:8788/homes"), harness.env, {
      identity: identityFor("stranger@example.com"),
    });
    assert.equal(response.status, 403);
    const audit = await recentAudit(harness.db, 5);
    assert.equal(audit[0].actor_email, "stranger@example.com");
    assert.equal(audit[0].outcome, "denied");
    assert.equal(audit[0].entity_type, "session");
  });

  it("sends the same hardening headers on every response", async () => {
    for (const path of ["/", "/homes", "/api/homes"]) {
      const response = await harness.request(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("X-Frame-Options"), "DENY");
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(response.headers.get("Referrer-Policy"), "same-origin");
      assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
      assert.match(response.headers.get("Content-Security-Policy") ?? "", /default-src 'none'/);
      assert.match(response.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
    }
  });

  it("tells search engines to stay away", async () => {
    const body = await (await harness.request("/")).text();
    assert.match(body, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  });

  it("answers 404 and 405 honestly", async () => {
    assert.equal((await harness.request("/nope")).status, 404);
    assert.equal((await harness.request("/api/inspections")).status, 405);
    assert.equal((await harness.request("/", { method: "POST" })).status, 405);
  });

  it("escapes user text rather than rendering it", async () => {
    await harness.request("/api/defects", {
      as: "dale@hplacer.com",
      ...form({ summary: '<img src=x onerror="alert(1)">', severity: "major", asset_id: "ast_ex1" }),
    });
    const body = await (await harness.request("/defects", { as: "brandon@hplacer.com" })).text();
    assert.ok(!body.includes("<img src=x"), "the raw tag must not reach the document");
    assert.match(body, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  });
});

describe("authorization through HTTP", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  const cases: { path: string; as: string; expect: number }[] = [
    { path: "/billing", as: "dale@hplacer.com", expect: 403 },
    { path: "/billing", as: "greg@hplacer.com", expect: 403 },
    { path: "/billing", as: "tara@hplacer.com", expect: 200 },
    { path: "/admin", as: "tara@hplacer.com", expect: 403 },
    { path: "/admin", as: "ops@hplacer.com", expect: 200 },
    { path: "/admin/monday", as: "greg@hplacer.com", expect: 403 },
    { path: "/admin/audit", as: "ops@hplacer.com", expect: 200 },
    { path: "/equipment/new", as: "dale@hplacer.com", expect: 403 },
    { path: "/equipment/new", as: "greg@hplacer.com", expect: 200 },
    { path: "/tasks/new", as: "dale@hplacer.com", expect: 403 },
    { path: "/inventory", as: "dale@hplacer.com", expect: 200 },
    { path: "/inventory/new", as: "greg@hplacer.com", expect: 403 },
    { path: "/inventory/new", as: "tara@hplacer.com", expect: 200 },
  ];

  for (const { path, as, expect } of cases) {
    it(`${expect} for ${as.split("@")[0]} at ${path}`, async () => {
      assert.equal((await harness.request(path, { as })).status, expect);
    });
  }

  it("blocks the write even when the caller skips the UI", async () => {
    const response = await harness.request("/api/repairs/rep_1/bill-back", {
      as: "greg@hplacer.com",
      ...jsonBody({ bill_back_status: "billed", amount: "100", invoice_reference: "X" }),
    });
    assert.equal(response.status, 403);
    const ticket = await harness.db.prepare("SELECT bill_back_status FROM repair_tickets WHERE id = 'rep_1'").first<{ bill_back_status: string }>();
    assert.equal(ticket?.bill_back_status, "review_needed", "nothing changed");
  });

  it("records refused writes in the audit log", async () => {
    const audit = await recentAudit(harness.db, 20);
    const denied = audit.find((entry) => entry.outcome === "denied" && entry.action.includes("bill-back"));
    assert.ok(denied);
    assert.equal(denied?.actor_email, "greg@hplacer.com");
    assert.match(denied?.detail ?? "", /^403/);
  });
});

describe("field workflow over HTTP", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("files a pre-use inspection from the rendered form and redirects", async () => {
    const page = await (await harness.request("/equipment/EX-01/inspect", { as: "dale@hplacer.com" })).text();
    assert.match(page, /Excavator pre-use/);
    assert.match(page, /name="answer_hydraulic_fluid"/);
    assert.match(page, /name="meter_reading"/);

    const response = await harness.request("/api/inspections", {
      as: "dale@hplacer.com",
      ...form({
        template_key: "daily_excavator",
        asset_id: "ast_ex1",
        meter_reading: "3190.4",
        redirect_to: "/equipment/EX-01",
        answer_walkaround: "pass",
        answer_engine_oil: "pass",
        answer_hydraulic_fluid: "fail",
        note_hydraulic_fluid: "Weeping at the boom cylinder base.",
        answer_coolant: "pass",
        answer_tracks: "pass",
        answer_bucket_teeth: "pass",
        answer_controls: "pass",
        answer_seatbelt: "pass",
        answer_fire_ext: "pass",
      }),
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/equipment/EX-01?ok=inspection_defects");

    const detail = await (await harness.request(response.headers.get("Location")!, { as: "dale@hplacer.com" })).text();
    assert.match(detail, /out of service/);
    assert.match(detail, /Defects were opened/);
  });

  it("refuses the same operator a second pre-use check that day", async () => {
    const response = await harness.request("/api/inspections", {
      as: "dale@hplacer.com",
      ...jsonBody({
        template_key: "daily_excavator",
        asset_id: "ast_ex1",
        meter_reading: 3191,
        answers: [
          "walkaround",
          "engine_oil",
          "hydraulic_fluid",
          "coolant",
          "tracks",
          "bucket_teeth",
          "controls",
          "seatbelt",
          "fire_ext",
        ].map((checklist_key) => ({ checklist_key, result: "pass" })),
      }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /already filed a pre-use inspection/);
  });

  it("opens a ticket from the defect and shows it on the machine", async () => {
    const defects = await harness.json<{ id: string }[]>("/api/repairs");
    assert.ok(defects);
    const defect = await harness.db
      .prepare("SELECT id FROM defects WHERE asset_id = 'ast_ex1' AND status = 'open' ORDER BY rowid DESC")
      .first<{ id: string }>();

    const response = await harness.request("/api/repairs", {
      as: "brett@hplacer.com",
      ...form({
        title: "Reseal the boom cylinder",
        description: "Rod seal weeping under load.",
        source_defect_id: defect!.id,
        responsible_party_type: "internal",
        bill_back: true,
      }),
    });
    assert.equal(response.status, 303);
    const location = response.headers.get("Location") ?? "";
    assert.match(location, /^\/repairs\/rep_[a-z0-9]+\?ok=ticket_created$/);

    const ticketPage = await (await harness.request(location.split("?")[0], { as: "brett@hplacer.com" })).text();
    assert.match(ticketPage, /Reseal the boom cylinder/);
    assert.match(ticketPage, /EX-01/);
  });

  it("uploads evidence and serves it back only to the right people", async () => {
    const body = new FormData();
    body.set("work_task_id", "tsk_1");
    body.set("document_type", "photo");
    body.set("redirect_to", "/tasks/tsk_1");
    body.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "skirting.png", { type: "image/png" }));

    const upload = await harness.request("/api/documents/upload", { as: "marcus@hplacer.com", method: "POST", body });
    assert.equal(upload.status, 303);

    const document = await harness.db
      .prepare("SELECT id, content_type FROM documents WHERE work_task_id = 'tsk_1' AND storage_provider = 'r2'")
      .first<{ id: string; content_type: string }>();

    const owner = await harness.request(`/api/documents/${document!.id}/content`, { as: "marcus@hplacer.com" });
    assert.equal(owner.status, 200);
    assert.equal(owner.headers.get("Content-Type"), "image/png");
    assert.match(owner.headers.get("Content-Disposition") ?? "", /^inline; filename="skirting.png"$/);

    const stranger = await harness.request(`/api/documents/${document!.id}/content`, { as: "nina@hplacer.com" });
    assert.equal(stranger.status, 403);
  });

  it("serves a non-image attachment rather than rendering it in the portal origin", async () => {
    const body = new FormData();
    body.set("home_id", "hom_a1");
    body.set("document_type", "receipt");
    body.set("redirect_to", "/homes/hom_a1");
    body.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "receipt.pdf", { type: "application/pdf" }));
    await harness.request("/api/documents/upload", { as: "wes@hplacer.com", method: "POST", body });

    const document = await harness.db
      .prepare("SELECT id FROM documents WHERE home_id = 'hom_a1' AND content_type = 'application/pdf'")
      .first<{ id: string }>();
    const response = await harness.request(`/api/documents/${document!.id}/content`, { as: "wes@hplacer.com" });
    assert.match(response.headers.get("Content-Disposition") ?? "", /^attachment; /);
  });

  it("will not close a photo-required task through the API either", async () => {
    const response = await harness.request("/api/tasks/tsk_4/complete", {
      as: "nina@hplacer.com",
      ...jsonBody({ notes: "Measured 11 ft 4 in at the culvert." }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /needs a photo/);
  });

  it("keeps a redirect on this origin", async () => {
    const body = new FormData();
    body.set("home_id", "hom_a1");
    body.set("document_type", "photo");
    body.set("redirect_to", "https://evil.example/steal");
    body.set("file", new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }));
    const response = await harness.request("/api/documents/upload", { as: "wes@hplacer.com", method: "POST", body });
    assert.equal(response.headers.get("Location"), "/?ok=uploaded");
  });

  it("only accepts a known confirmation code in the flash slot", async () => {
    const page = await (await harness.request("/?ok=%3Cscript%3Ealert(1)%3C/script%3E")).text();
    assert.ok(!page.includes("<script>alert(1)</script>"));
    assert.ok(!page.includes("class=\"notice"), "an unknown code renders no banner at all");
  });
});

describe("JSON API", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("returns homes with their job and lot", async () => {
    const { homes } = await harness.json<{ homes: { serial_number: string; job_number: string | null }[] }>("/api/homes");
    assert.equal(homes.length, 4);
    assert.ok(homes.some((home) => home.serial_number === "CAV2026NC114772A" && home.job_number === "HP-2601"));
  });

  it("searches equipment by VIN", async () => {
    const { assets } = await harness.json<{ assets: { asset_tag: string }[] }>("/api/equipment?q=1FVACWDT0LHLR2201");
    assert.deepEqual(assets.map((asset) => asset.asset_tag), ["DT-01"]);
  });

  it("scopes the repair list to the caller", async () => {
    const asNina = await harness.json<{ repairs: unknown[] }>("/api/repairs", { as: "nina@hplacer.com" });
    const asBrett = await harness.json<{ repairs: unknown[] }>("/api/repairs", { as: "brett@hplacer.com" });
    assert.equal(asNina.repairs.length, 0);
    assert.ok(asBrett.repairs.length > 0);
  });

  it("reports a validation failure as JSON, not as a page", async () => {
    const response = await harness.request("/api/subdivisions", { ...jsonBody({ title: "No number" }) });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.deepEqual(await response.json(), { error: "bad_request", message: "Subdivision number is required" });
  });

  it("records allowed writes in the audit log", async () => {
    await harness.request("/api/subdivisions", { ...form({ job_number: "HP-2699", title: "Audit test" }) });
    const audit = await recentAudit(harness.db, 5);
    const entry = audit.find((row) => row.action === "POST /api/subdivisions" && row.outcome === "allowed");
    assert.ok(entry);
    assert.equal(entry?.actor_email, "ops@hplacer.com");
  });
});
