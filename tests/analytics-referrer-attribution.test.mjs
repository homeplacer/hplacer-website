import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile src/lib/analytics.ts once, then load it in an isolated VM with injected
// browser globals so we exercise the REAL code offline — no network, no live GA.
//
// SCOPE NOTE: these tests verify ONLY the payload this module hands to gtag (our
// emission contract and its privacy invariants). They do NOT establish what the
// Google tag transmits or how GA4 computes session source — that stays a GA4
// DebugView validation item, intentionally unresolved here.
const SOURCE = ts.transpileModule(readFileSync("src/lib/analytics.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Fresh module instance (its own navigation state) with a stubbed window/document
// and a gtag spy that records every emitted event. `win`/`doc` are returned so a
// test can drive client-side navigation (change pathname) and keep document.referrer
// stable across it, as a real SPA does.
function loadWith({ referrer = "", pathname = "/", origin = "https://hplacer.com" } = {}) {
  const events = [];
  const win = {
    location: { pathname, origin },
    dataLayer: [],
    gtag: (...args) => events.push(args),
  };
  const doc = { referrer };
  const ctx = { exports: {}, URL, console, window: win, document: doc };
  runInNewContext(SOURCE, ctx);
  return { api: ctx.exports, events, win, doc };
}

const refOf = (events) => events.map((e) => e[2].page_referrer);
const { api } = loadWith();
const origin = (ref) => api.approvedReferrerOrigin(ref, "https://hplacer.com");

test("approvedReferrerOrigin: canonical Google Search origins allowed (origin only)", () => {
  assert.equal(origin("https://www.google.com/"), "https://www.google.com");
  assert.equal(origin("https://www.google.com"), "https://www.google.com");
  assert.equal(origin("https://google.com/"), "https://google.com");
});

test("approvedReferrerOrigin: strips path, query and fragment — never leaks them", () => {
  const out = origin("https://www.google.com/search?q=buy+a+home+for+jane+doe#top");
  assert.equal(out, "https://www.google.com");
  assert.doesNotMatch(out, /[?#]/);
  assert.doesNotMatch(out, /search|jane|doe|q=/);
});

test("approvedReferrerOrigin: adversarial referrers all resolve to '' (Direct)", () => {
  const cases = [
    "", undefined, null,
    "https://news.google.com/", // non-allowlisted subdomain
    "https://www.google.com.evil.example/", // spoofed-subdomain host
    "https://evilgoogle.com/", // look-alike host
    "https://user:p%40ss@www.google.com/", // userinfo / credentials
    "https://www.google.com:8443/", // non-default port
    "http://www.google.com/", // not https
    "https://www.bing.com/", "https://duckduckgo.com/", "https://www.facebook.com/", // not Google
    "https://hplacer.com/some/internal/page", // internal navigation
    "android-app://com.google.android.googlequicksearchbox/", // app scheme
    "javascript:alert(document.cookie)", "data:text/html,evil", // hostile schemes
    "not even a url", "//www.google.com", // malformed
  ];
  for (const c of cases) assert.equal(origin(c), "", `expected "" for referrer: ${String(c)}`);
});

test("approvedReferrerOrigin: internal origin is never treated as a source", () => {
  assert.equal(
    api.approvedReferrerOrigin("https://www.hplacer.com/", "https://www.hplacer.com"),
    "",
  );
});

test("landing page_view: Google organic emits the bare origin only, no leakage", () => {
  const { api: inst, events } = loadWith({
    referrer: "https://www.google.com/search?q=manufactured+home+conway+sc",
    pathname: "/homes/beacon",
  });
  inst.track("page_view");
  assert.equal(events.length, 1);
  const [kind, name, payload] = events[0];
  assert.equal(kind, "event");
  assert.equal(name, "page_view");
  assert.equal(payload.page_referrer, "https://www.google.com");
  assert.equal(payload.page_location, "https://hplacer.com/homes/beacon");
  assert.equal(payload.page_title, "Home Placer /homes/beacon");
  assert.doesNotMatch(JSON.stringify(payload), /q=|manufactured\+home|search\?/);
});

test("landing page_view: direct and internal referrers emit empty page_referrer", () => {
  for (const referrer of ["", "https://hplacer.com/financing"]) {
    const { api: inst, events } = loadWith({ referrer, pathname: "/financing" });
    inst.track("page_view");
    assert.equal(events[0][2].page_referrer, "", `referrer ${JSON.stringify(referrer)} → ""`);
  }
});

test("sequential SPA navigation: external origin only on the landing, then previous internal location", () => {
  const { api: inst, events, win } = loadWith({
    referrer: "https://www.google.com/search?q=x",
    pathname: "/",
  });
  inst.track("page_view"); // landing "/"
  win.location.pathname = "/homes/beacon";
  inst.track("page_view"); // virtual pageview
  win.location.pathname = "/financing";
  inst.track("page_view"); // virtual pageview
  assert.deepEqual(events.map((e) => e[2].page_location), [
    "https://hplacer.com/",
    "https://hplacer.com/homes/beacon",
    "https://hplacer.com/financing",
  ]);
  // page_referrer updates correctly between screens (GA4 SPA guidance), and the
  // external origin appears exactly once — on the landing only.
  assert.deepEqual(refOf(events), [
    "https://www.google.com",
    "https://hplacer.com/",
    "https://hplacer.com/homes/beacon",
  ]);
  assert.equal(refOf(events).filter((r) => r === "https://www.google.com").length, 1);
});

test("actions never carry the external acquisition origin", () => {
  const { api: inst, events, win } = loadWith({ referrer: "https://www.google.com/", pathname: "/" });
  inst.track("page_view"); // landing → external origin
  inst.track("phone_call", { placement: "header" }); // action on landing
  win.location.pathname = "/financing";
  inst.track("page_view"); // virtual pageview → previous internal
  inst.track("financing_click", { placement: "main_content" }); // action
  const rows = events.map((e) => ({ ev: e[1], ref: e[2].page_referrer }));
  assert.equal(rows[0].ref, "https://www.google.com");
  assert.equal(rows[1].ref, ""); // phone_call
  assert.equal(rows[2].ref, "https://hplacer.com/"); // virtual pageview → previous internal
  assert.equal(rows[3].ref, ""); // financing_click
  for (const r of rows.filter((x) => x.ev !== "page_view")) {
    assert.notEqual(r.ref, "https://www.google.com");
  }
});

test("return-after-inactivity: stale document.referrer is never re-sent after the landing", () => {
  // document.referrer does NOT change on client-side navigation, so it stays Google
  // for the whole SPA session. A GA4 session can time out (~30 min) and a later
  // event would start a NEW session; that event must NOT carry the stale Google
  // referrer, or the new session is mis-attributed to Google organic.
  const { api: inst, events, win, doc } = loadWith({
    referrer: "https://www.google.com/search?q=stale",
    pathname: "/",
  });
  inst.track("page_view"); // landing (consumes the external origin once)
  assert.equal(doc.referrer, "https://www.google.com/search?q=stale"); // still Google
  win.location.pathname = "/process";
  inst.track("page_view"); // resumed session: virtual pageview
  inst.track("phone_call", { placement: "footer" }); // resumed session: action
  for (const r of refOf(events).slice(1)) {
    assert.notEqual(r, "https://www.google.com", "no event after landing may re-send the stale origin");
  }
  assert.doesNotMatch(JSON.stringify(events), /q=stale|search\?/);
});

test("existing safeguards preserved — location sanitized, unknown params dropped", () => {
  const { api: inst, events } = loadWith({
    referrer: "https://www.google.com/search?q=secret",
    pathname: "/admin/private-secret-path",
  });
  inst.track("page_view", { secret_value: "leak-me", form_type: "contact" });
  const payload = events[0][2];
  assert.equal(payload.page_location, "https://hplacer.com/"); // non-allowlisted section → "/"
  assert.equal(payload.secret_value, undefined); // disallowed param dropped
  assert.equal(payload.form_type, "contact"); // allowlisted value kept
  assert.doesNotMatch(JSON.stringify(payload), /private-secret-path|leak-me/);
});
