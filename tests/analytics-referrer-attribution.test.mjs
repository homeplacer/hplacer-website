import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile src/lib/analytics.ts once, then load it in an isolated VM with injected
// browser globals so we exercise the REAL code offline — no network, no live GA.
const SOURCE = ts.transpileModule(readFileSync("src/lib/analytics.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Fresh module instance with a stubbed window/document and a gtag spy that
// records every emitted event payload (the "offline intercept").
function loadWith({ referrer = "", pathname = "/", origin = "https://hplacer.com" } = {}) {
  const events = [];
  const win = {
    location: { pathname, origin },
    dataLayer: [],
    gtag: (...args) => events.push(args),
  };
  const ctx = { exports: {}, URL, console, window: win, document: { referrer } };
  runInNewContext(SOURCE, ctx);
  return { api: ctx.exports, events };
}

const { api } = loadWith();
const origin = (ref) => api.approvedReferrerOrigin(ref, "https://hplacer.com");

test("approvedReferrerOrigin: canonical Google Search origins allowed (origin only)", () => {
  assert.equal(origin("https://www.google.com/"), "https://www.google.com");
  assert.equal(origin("https://www.google.com"), "https://www.google.com");
  assert.equal(origin("https://google.com/"), "https://google.com");
});

test("approvedReferrerOrigin: strips path, query and fragment — never leaks them", () => {
  // A real Google organic referrer can carry the user's search terms; only the
  // bare origin may ever reach GA4.
  const out = origin("https://www.google.com/search?q=buy+a+home+for+jane+doe#top");
  assert.equal(out, "https://www.google.com");
  assert.doesNotMatch(out, /[?#]/);
  assert.doesNotMatch(out, /search|jane|doe|q=/);
});

test("approvedReferrerOrigin: adversarial referrers all resolve to '' (Direct)", () => {
  const cases = [
    "", // direct / no referrer
    undefined,
    null,
    "https://news.google.com/", // non-allowlisted subdomain
    "https://www.google.com.evil.example/", // spoofed-subdomain host
    "https://evilgoogle.com/", // look-alike host
    "https://user:p%40ss@www.google.com/", // userinfo / credentials
    "https://www.google.com:8443/", // non-default port
    "http://www.google.com/", // not https
    "https://www.bing.com/", // not Google (bounded to the evidence)
    "https://duckduckgo.com/", // not Google
    "https://www.facebook.com/", // social not in scope
    "https://hplacer.com/some/internal/page", // internal navigation
    "android-app://com.google.android.googlequicksearchbox/", // app scheme
    "javascript:alert(document.cookie)", // hostile scheme
    "data:text/html,evil", // data scheme
    "not even a url", // malformed
    "//www.google.com", // schemeless / malformed
  ];
  for (const c of cases) {
    assert.equal(origin(c), "", `expected "" for referrer: ${String(c)}`);
  }
});

test("approvedReferrerOrigin: internal origin is never treated as a source", () => {
  assert.equal(
    api.approvedReferrerOrigin("https://www.hplacer.com/", "https://www.hplacer.com"),
    "",
  );
});

test("track(): offline intercept — Google organic emits the bare origin only, no leakage", () => {
  const { api: inst, events } = loadWith({
    referrer: "https://www.google.com/search?q=manufactured+home+conway+sc",
    pathname: "/homes/beacon",
  });
  inst.track("page_view");
  assert.equal(events.length, 1, "exactly one GA event emitted");
  const [kind, name, payload] = events[0];
  assert.equal(kind, "event");
  assert.equal(name, "page_view");
  assert.equal(payload.page_referrer, "https://www.google.com");
  assert.equal(payload.page_location, "https://hplacer.com/homes/beacon");
  assert.equal(payload.page_title, "Home Placer /homes/beacon");
  // Hard privacy invariant: nothing in the emitted payload carries the query.
  assert.doesNotMatch(JSON.stringify(payload), /q=|manufactured\+home|search\?/);
});

test("track(): direct and internal referrers emit empty page_referrer", () => {
  for (const referrer of ["", "https://hplacer.com/financing"]) {
    const { api: inst, events } = loadWith({ referrer, pathname: "/financing" });
    inst.track("page_view");
    assert.equal(events[0][2].page_referrer, "", `referrer ${JSON.stringify(referrer)} → ""`);
  }
});

test("track(): existing safeguards preserved — location sanitized, unknown params dropped", () => {
  const { api: inst, events } = loadWith({
    referrer: "https://www.google.com/search?q=secret",
    pathname: "/admin/private-secret-path",
  });
  // A disallowed param must be dropped, and a non-allowlisted section must
  // collapse to "/" so no raw path leaks into page_location.
  inst.track("page_view", { secret_value: "leak-me", form_type: "contact" });
  const payload = events[0][2];
  assert.equal(payload.page_location, "https://hplacer.com/"); // sanitized, not the admin path
  assert.equal(payload.secret_value, undefined); // disallowed param dropped
  assert.equal(payload.form_type, "contact"); // allowlisted value kept
  assert.doesNotMatch(JSON.stringify(payload), /private-secret-path|leak-me/);
});
