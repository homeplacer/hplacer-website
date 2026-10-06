// Execute the unchanged frontend lead helper with in-memory mocks. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ["src/lib/lead.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
  plugins: [{
    name: "frontend-contract-mocks",
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(analytics|attribution)$/ }, args => ({
        path: args.path.slice(2), namespace: "contract",
      }));
      builder.onLoad({ filter: /.*/, namespace: "contract" }, args => ({
        contents: args.path === "analytics"
          ? "export const track = (...args) => recordTrack(...args); export const modelSlugFromPath = () => null;"
          : "export const getAttribution = () => fixtureAttribution;",
        loader: "js",
      }));
    },
  }],
});

const data = { name: "Synthetic Visitor", email: "visitor@example.test", phone: "202-555-0100", message: "Fixture only" };
const attribution = { utm_source: "fixture", landing_page: "https://example.test/synthetic" };

function harness(response) {
  const requests = [];
  const events = [];
  const window = { location: { pathname: "/contact", href: "https://example.test/contact" } };
  const fixtureModule = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, {
    module: fixtureModule, exports: fixtureModule.exports, require, window,
    fixtureAttribution: attribution,
    recordTrack: (name, params) => events.push({ name, params: JSON.parse(JSON.stringify(params)) }),
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (response instanceof Error) throw response;
      return response;
    },
  });
  return { submitLead: fixtureModule.exports.submitLead, requests, events, window };
}

test("contact intake remains JSON POST with unchanged attribution and pathname", async () => {
  const fixture = harness({ ok: true, status: 200 });
  assert.equal(await fixture.submitLead("contact", data), "api");
  assert.equal(fixture.requests.length, 1);
  const request = fixture.requests[0];
  assert.equal(request.url, "/api/lead");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), { type: "contact", ...data, attribution, pagePath: "/contact" });
  assert.deepEqual(fixture.events, [{ name: "generate_lead", params: { form_type: "contact", submission_method: "api" } }]);
  assert.equal(fixture.window.location.href, "https://example.test/contact");
});

test("a validation rejection remains an error, not an email draft or confirmed lead", async () => {
  const fixture = harness({ ok: false, status: 422 });
  assert.equal(await fixture.submitLead("contact", data), "error");
  assert.deepEqual(fixture.events, []);
  assert.equal(fixture.window.location.href, "https://example.test/contact");
});

for (const [label, response] of [["server failure", { ok: false, status: 503 }], ["network failure", new Error("Synthetic offline")]]) {
  test(`${label} preserves the unsent mailto fallback and its attribution`, async () => {
    const fixture = harness(response);
    assert.equal(await fixture.submitLead("contact", data), "mailto");
    assert.equal(fixture.requests.length, 1);
    const draft = new URL(fixture.window.location.href);
    assert.equal(draft.protocol, "mailto:");
    assert.match(draft.searchParams.get("body"), /Phone: 202-555-0100/);
    assert.match(draft.searchParams.get("body"), /utm_source: fixture/);
    assert.match(draft.searchParams.get("body"), /landing_page: https:\/\/example.test\/synthetic/);
    assert.deepEqual(fixture.events, [{ name: "lead_submission_fallback", params: { form_type: "contact", submission_method: "mailto" } }]);
  });
}
