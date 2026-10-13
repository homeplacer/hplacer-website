import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile src/lib/analytics.ts once and load it in an isolated VM with stubbed
// browser globals + a gtag spy, so we exercise the REAL allowlist/track code
// offline — no network, no live GA, no real lead.
//
// SCOPE NOTE: these verify ONLY the payload this module hands to gtag (the event
// contract + its privacy invariants). They do NOT establish what the Google tag
// transmits or what GA4 records — that stays a GA4 validation item (needs access).
const ANALYTICS = ts.transpileModule(readFileSync("src/lib/analytics.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load({ pathname = "/land-packages", origin = "https://hplacer.com" } = {}) {
  const events = [];
  const win = {
    location: { pathname, origin },
    dataLayer: [],
    gtag: (...args) => events.push(args),
  };
  const ctx = { exports: {}, URL, console, window: win, document: { referrer: "" } };
  runInNewContext(ANALYTICS, ctx);
  return { api: ctx.exports, events };
}

const EVENT = "existing_inventory_handoff";

test("event is allowlisted and emits only the inventory_type + placement enums", () => {
  const { api, events } = load();
  api.track(EVENT, { inventory_type: "owned_land", placement: "main_content" });
  assert.equal(events.length, 1);
  const [kind, name, payload] = events[0];
  assert.equal(kind, "event");
  assert.equal(name, EVENT);
  assert.equal(payload.inventory_type, "owned_land");
  assert.equal(payload.placement, "main_content");
  assert.equal(payload.page_location, "https://hplacer.com/land-packages");
});

test("all three inventory_type enum values are accepted", () => {
  for (const value of ["all", "owned_land", "leased_land"]) {
    const { api, events } = load();
    api.track(EVENT, { inventory_type: value, placement: "main_content" });
    assert.equal(events[0][2].inventory_type, value);
  }
});

test("values outside the inventory_type allowlist are dropped (never emitted)", () => {
  const { api, events } = load();
  api.track(EVENT, { inventory_type: "123 Main St, Conway SC", placement: "main_content" });
  const payload = events[0][2];
  assert.equal(payload.inventory_type, undefined); // dropped
  assert.equal(payload.placement, "main_content"); // allowlisted value kept
});

test("privacy: href / query / arbitrary params never reach the payload", () => {
  const { api, events } = load();
  api.track(EVENT, {
    inventory_type: "leased_land",
    placement: "main_content",
    // Hostile extras an attacker/mistake might pass — all must be dropped.
    href: "https://forturro.com/search?mfgTenure=leased&type=Manufactured",
    query: "mfgTenure=leased",
    email: "visitor@example.test",
    page_referrer: "https://www.google.com/search?q=secret",
  });
  const payload = events[0][2];
  assert.equal(payload.inventory_type, "leased_land");
  assert.equal(payload.placement, "main_content");
  assert.equal(payload.href, undefined);
  assert.equal(payload.query, undefined);
  assert.equal(payload.email, undefined);
  // The module forces its own sanitized page_referrer (empty on this branch), not the passed one.
  assert.notEqual(payload.page_referrer, "https://www.google.com/search?q=secret");
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /mfgTenure|forturro\.com\/search|visitor@|secret/);
});

test("no global outbound collection: a non-allowlisted event name emits nothing", () => {
  const { api, events } = load();
  api.track("outbound_click", { inventory_type: "all", placement: "main_content" });
  api.track("click", { placement: "main_content" });
  assert.equal(events.length, 0);
});

test("handler wiring (analytics-events.tsx): reads the attribute, emits the enum, leaks no href/query", () => {
  const src = readFileSync("src/components/analytics-events.tsx", "utf8");
  // Reads the frontend-owned data attribute (not the href).
  assert.match(src, /getAttribute\("data-existing-inventory"\)/);
  // Emits the scoped event with inventory_type + placement only.
  assert.match(
    src,
    /track\(\s*"existing_inventory_handoff",\s*\{\s*inventory_type:\s*inventoryType,\s*placement\s*\}\s*\)/,
  );
  // The existing land_handoff is NOT repurposed and is still present.
  assert.match(src, /track\("land_handoff",\s*\{\s*placement,\s*destination:\s*"forturro\.com"\s*\}\)/);
  // The event CALL itself (excluding comments) forwards no href/query/search.
  const callStart = src.indexOf('track("existing_inventory_handoff"');
  assert.ok(callStart > 0, "event call present");
  assert.doesNotMatch(src.slice(callStart, callStart + 120), /href|getAttribute|location\.search|query/);
});
