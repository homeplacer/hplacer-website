import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
async function load(source) {
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(out).toString("base64")}`
  );
}
const policy = await load(readFileSync("src/lib/package-policy.ts", "utf8"));
const robots = await load(readFileSync("src/lib/robots-policy.ts", "utf8"));
const data = json("data/land-home-packages.json");
const models = new Set(json("data/models.json").map((m) => m.slug));
const now = Date.parse("2026-09-13T12:00:00Z");
const active = () => ({
  ...structuredClone(data.packages[0]),
  status: "available",
  publication: "approved",
  owner: "TEST FIXTURE ONLY",
  pricePolicy: "verified-total",
  packagePrice: 123456,
  history: [
    {
      status: "available",
      at: "2026-09-13T00:00:00Z",
      reason: "TEST FIXTURE ONLY",
    },
  ],
});
test("real seeds retain source provenance and are never current offers", () => {
  for (const p of data.packages) {
    assert.deepEqual(policy.packageErrors(p, models, now), []);
    assert.equal(p.status, "sold");
    assert.equal(p.packagePrice, null);
    assert.equal(p.publicPhotos.length, 0);
    assert.equal(policy.packageOffer(p, now), null);
  }
});
test("available, under contract, sold, withdrawn and stale are distinct", () => {
  const p = active();
  assert.deepEqual(policy.packageErrors(p, models, now), []);
  assert.ok(policy.packageOffer(p, now));
  p.status = "under_contract";
  assert.equal(policy.packageOffer(p, now), null);
  assert.ok(policy.packageIsPublic(p, now));
  p.status = "sold";
  assert.ok(policy.packageIsPublic(p, now));
  p.status = "withdrawn";
  assert.equal(policy.packageIsPublic(p, now), false);
  p.status = "draft";
  assert.equal(policy.packageIsPublic(p, now), false);
  p.status = "available";
  const expires = Date.parse(p.lastVerifiedAt) + policy.FRESHNESS_MS;
  assert.equal(policy.packageState(p, expires), "needs_verification");
  assert.equal(policy.packageIsPublic(p, expires), false);
  assert.equal(policy.packageOffer(p, expires), null);
});
test("unverified approval, invalid models, private media and dates fail validation", () => {
  for (const change of [
    { owner: null },
    { modelSlug: "unknown" },
    { lastVerifiedAt: "invalid" },
    { lastVerifiedAt: "2999-01-01" },
    { publicPhotos: ["/packages/test.jpg"], mediaPermission: null },
    { packagePrice: 0 },
    { pricePolicy: "not-published" },
    { publication: "historical-summary" },
    { history: [] },
  ])
    assert.ok(
      policy.packageErrors({ ...active(), ...change }, models, now).length,
      JSON.stringify(change),
    );
});
test("robots allow retrieval, reject training, and preserve private exclusions in each retrieval group", () => {
  const text = robots.robotsText();
  assert.match(text, /search=yes, ai-input=yes, ai-train=no/);
  for (const bot of robots.retrievalBots) {
    const block = text.split(`User-agent: ${bot}\n`)[1].split("\n\n")[0];
    assert.match(block, /Allow: \//);
    for (const path of robots.privatePaths)
      assert.ok(block.includes(`Disallow: ${path}`));
  }
  for (const bot of robots.trainingBots)
    assert.ok(text.includes(`User-agent: ${bot}\nDisallow: /\n`));
});
// All network traffic in these route tests is stubbed; no real lead leaves the process.
let source = readFileSync("src/app/api/lead/route.ts", "utf8")
  .replace(
    'import { NextResponse } from "next/server";',
    "const NextResponse = {json:(body,init)=>Response.json(body,init)};",
  )
  .replace(
    'import { packageLeadContext } from "@/lib/packages";',
    'const packageLeadContext = id => id === "historical-001" ? {packageId:id,modelSlug:"stayin-alive",market:"Conway, SC",packageStatus:"sold"} : {};',
  )
  .replace(
    'import { modelSlugFromPath, analyticsPath } from "@/lib/analytics";',
    'const modelSlugFromPath=()=>null; const analyticsPath=()=>"/contact";',
  );
const route = await load(source);
const req = (body) =>
  new Request("http://localhost/api/lead", {
    method: "POST",
    body: JSON.stringify(body),
  });
test("lead intake rejects invalid shapes/types and honeypots before any delivery", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("unexpected network");
  };
  try {
    assert.equal((await route.POST(req(null))).status, 400);
    assert.equal((await route.POST(req({ type: "bad" }))).status, 422);
    assert.equal(
      (await route.POST(req({ name: { bad: 1 }, phone: 1 }))).status,
      422,
    );
    assert.equal((await route.POST(req({ company: "bot" }))).status, 200);
    assert.equal(
      (await route.POST(req({ message: "x".repeat(33000) }))).status,
      413,
    );
  } finally {
    globalThis.fetch = saved;
  }
});
test("failed delivery cannot generate a confirmed-success response", async () => {
  const saved = {
    f: process.env.FUB_API_KEY,
    r: process.env.RESEND_API_KEY,
    w: process.env.LEAD_FAILURE_WEBHOOK_URL,
  };
  delete process.env.FUB_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.LEAD_FAILURE_WEBHOOK_URL;
  try {
    const res = await route.POST(
      req({ name: "Local test", phone: "2025550100" }),
    );
    assert.equal(res.status, 503);
    assert.match((await res.json()).leadId, /^[a-f0-9-]{36}$/);
  } finally {
    for (const [k, v] of Object.entries({
      FUB_API_KEY: saved.f,
      RESEND_API_KEY: saved.r,
      LEAD_FAILURE_WEBHOOK_URL: saved.w,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
test("successful intake adds one server reference and validated package context to CRM payload", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.FUB_API_KEY;
  const oldResend = process.env.RESEND_API_KEY;
  process.env.FUB_API_KEY = "LOCAL_TEST_ONLY";
  delete process.env.RESEND_API_KEY;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.followupboss.com/v1/events");
    sent.push(JSON.parse(init.body));
    return Response.json({ id: 123 }, { status: 200 });
  };
  try {
    const res = await route.POST(
      req({
        name: "Local fixture",
        phone: "2025550100",
        packageId: "historical-001",
        pagePath: "/packages/historical-001?private=x",
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(sent[0].message.includes(body.leadId));
    assert.match(sent[0].message, /Acquisition channel: direct/);
    assert.match(
      sent[0].message,
      /Package: historical-001 \(sold\); market: Conway, SC/,
    );
    assert.doesNotMatch(sent[0].message, /private=x/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FUB_API_KEY;
    else process.env.FUB_API_KEY = oldKey;
    if (oldResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldResend;
  }
});
test("lead acquisition bucket uses click IDs before a known search referrer", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.FUB_API_KEY;
  process.env.FUB_API_KEY = "LOCAL_TEST_ONLY";
  const sent = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.followupboss.com/v1/events");
    sent.push(JSON.parse(init.body));
    return Response.json({ id: 456 }, { status: 200 });
  };
  try {
    const res = await route.POST(req({
      name: "Local fixture",
      phone: "2025550100",
      attribution: { gclid: "local-test", referrer: "https://www.google.com/search?q=test" },
    }));
    assert.equal(res.status, 200);
    assert.match(sent[0].message, /Acquisition channel: paid_search/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FUB_API_KEY;
    else process.env.FUB_API_KEY = oldKey;
  }
});
