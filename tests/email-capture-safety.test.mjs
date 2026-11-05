// Actual newsletter component + frontend JSON helper, with every request intercepted.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadForms, createFormDriver } from "./fixtures/public-lead-form-components.mjs";

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ["src/lib/lead.ts"], bundle: true, write: false,
  platform: "node", format: "cjs", logLevel: "silent",
  plugins: [{
    name: "newsletter-contract-mocks",
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
const values = { name: "Synthetic Visitor", phone: "202-555-0100", email: "visitor@example.test" };
const attribution = { utm_source: "fixture", landing_page: "https://example.test/synthetic" };

function harness() {
  const requests = [];
  const events = [];
  const window = { location: { pathname: "/models", href: "https://example.test/models" } };
  const fixtureModule = { exports: {} };
  let settle;
  runInNewContext(bundle.outputFiles[0].text, {
    module: fixtureModule, exports: fixtureModule.exports, require, window,
    fixtureAttribution: attribution,
    recordTrack: (name, params) => events.push({ name, params: JSON.parse(JSON.stringify(params)) }),
    fetch: (url, options) => {
      requests.push({ url, ...options });
      return new Promise(resolve => { settle = resolve; });
    },
  });
  const driver = createFormDriver("subscribe", {}, true, { submitLead: fixtureModule.exports.submitLead });
  driver.form.entries = [...Object.entries(values), ["company", ""]];
  return { driver, requests, events, window, resolve: response => settle(response) };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

test("newsletter SSR is inert; hydrated markup retains native keyboard submission and required contact fields", () => {
  const serverHtml = renderToStaticMarkup(React.createElement(loadForms().subscribe));
  assert.doesNotMatch(serverHtml, /<form[\s>]|\baction=|\bmethod=/);
  assert.match(serverHtml, /<fieldset disabled=""/);
  assert.match(serverHtml, /<button type="submit" disabled=""/);

  const hydrated = loadForms({ react: { ...React, useSyncExternalStore: () => true } });
  const html = renderToStaticMarkup(React.createElement(hydrated.subscribe));
  assert.match(html, /<form data-form-type="subscribe" aria-busy="false" aria-describedby="[^"]+-error">/);
  assert.doesNotMatch(html, /<fieldset[^>]*disabled=|<button[^>]*disabled=/);
  assert.match(html, /<button type="submit"/);
  for (const name of ["name", "phone", "email"]) {
    const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
    assert.ok(input, name);
    assert.match(input, /required=""/);
    assert.match(input, /aria-describedby="[^"]+-error"/);
    assert.match(input, /aria-label="[^"]+"/);
  }
  assert.match(html.match(/<input[^>]*name="phone"[^>]*>/)[0], /type="tel"[^>]*pattern=/);
  assert.match(html.match(/<input[^>]*name="email"[^>]*>/)[0], /type="email"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true" class="sr-only"><\/p>/);
  assert.match(html, /role="alert" aria-atomic="true" tabindex="-1" class="sr-only"><\/p>/);
});

test("hydrated newsletter sends one JSON request, captures before disabling and focuses confirmed signup", async () => {
  const fixture = harness();
  const first = fixture.driver.submit();
  await fixture.driver.submit();
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.driver.order.slice(0, 2), ["serialize", "sending"]);
  assert.equal(fixture.driver.form.resets, 0);
  const request = fixture.requests[0];
  assert.equal(request.url, "/api/lead");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), { type: "subscribe", ...values, attribution, pagePath: "/models" });
  fixture.resolve({ ok: true, status: 200 });
  await first;
  const result = fixture.driver.render();
  assert.equal(result.status, "sent");
  assert.equal(fixture.driver.form.resets, 1);
  assert.match(result.successAnnouncement, /subscribed/);
  const heading = find(result.confirmation, node => node.type === "h3");
  assert.equal(heading.props.tabIndex, -1);
  const focusCalls = [];
  heading.props.ref.current = { focus: options => focusCalls.push(JSON.parse(JSON.stringify(options))) };
  fixture.driver.flushEffects();
  assert.deepEqual(focusCalls, [{ preventScroll: true }]);
  await fixture.driver.submit();
  assert.equal(fixture.requests.length, 1, "confirmation cannot generate another signup");
  assert.deepEqual(fixture.events, [{ name: "generate_lead", params: { form_type: "subscribe", submission_method: "api" } }]);
});

test("newsletter validation rejection preserves entries, focuses feedback and permits one explicit retry", async () => {
  const fixture = harness();
  const first = fixture.driver.submit();
  fixture.resolve({ ok: false, status: 422 });
  await first;
  const result = fixture.driver.render();
  assert.equal(result.status, "error");
  assert.equal(fixture.driver.form.resets, 0);
  assert.deepEqual(fixture.driver.form.entries, [...Object.entries(values), ["company", ""]]);
  let focusCount = 0;
  result.errorRef.current = { focus: () => { focusCount++; } };
  fixture.driver.flushEffects();
  assert.equal(focusCount, 1);
  assert.deepEqual(fixture.events, []);
  const retry = fixture.driver.submit();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.requests[0].body, fixture.requests[1].body);
  fixture.resolve({ ok: true, status: 200 });
  await retry;
  assert.equal(fixture.driver.form.resets, 1);
});

test("newsletter provider failure keeps the mail draft distinct from a confirmed subscription", async () => {
  const fixture = harness();
  const first = fixture.driver.submit();
  fixture.resolve({ ok: false, status: 503 });
  await first;
  const result = fixture.driver.render();
  assert.match(result.successAnnouncement, /not been sent yet/);
  assert.match(renderToStaticMarkup(result.confirmation), /hit send to subscribe/);
  assert.equal(fixture.requests.length, 1);
  const draft = new URL(fixture.window.location.href);
  assert.equal(draft.protocol, "mailto:");
  assert.match(draft.searchParams.get("body"), /Phone: 202-555-0100/);
  assert.deepEqual(fixture.events, [{ name: "lead_submission_fallback", params: { form_type: "subscribe", submission_method: "mailto" } }]);
});
