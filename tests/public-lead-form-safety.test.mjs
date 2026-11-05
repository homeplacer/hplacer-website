import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadForms, createFormDriver } from "./fixtures/public-lead-form-components.mjs";

const forms = loadForms();
const contracts = {
  subscribe: { type: "subscribe", names: "company name phone email", required: "name phone email" },
  financing: { type: "financing", names: "company name phone email hasLand", required: "name phone" },
  service: { type: "service", names: "company name phone email address message", required: "name phone message" },
  pricing: { type: "model_pricing", names: "company name phone email message", required: "name phone" },
  warranty: { type: "warranty", names: "company name phone email serial address city state zip summary details photos preferred_contact best_time", required: "name summary" },
  careers: { type: "careers", names: "company name phone email location position available_on experience credentials references resume consent", required: "name phone email location position experience consent" },
};
const tags = html => [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map(match => match[0]);
const field = (html, name) => tags(html).find(tag => tag.includes(`name="${name}"`));
const render = (key, props = {}) => renderToStaticMarkup(React.createElement(forms[key], props));
const response = (ok, body = {}) => ({ ok, json: async () => body });
const entries = [["name", "Synthetic Visitor"], ["phone", "8435550100"], ["email", "visitor@example.test"], ["company", ""]];

for (const [key, contract] of Object.entries(contracts)) {
  test(`${key}: real SSR has no native submission path, stable region and accessible fallback`, () => {
    const html = render(key);
    assert.doesNotMatch(html, /<form[\s>]/);
    assert.match(html, new RegExp(`data-form-region="${contract.type}"`));
    assert.match(html, new RegExp(`data-form-type="${contract.type}"`));
    assert.match(html, /<fieldset disabled=""/);
    assert.match(html, /<button[^>]*disabled=""/);
    assert.match(html, /role="status" aria-live="polite" aria-atomic="true" class="sr-only"><\/p>/);
    assert.match(html, /role="alert" aria-atomic="true" tabindex="-1" class="sr-only"><\/p>/);
    const phone = ["service", "warranty"].includes(key) ? "18434849844" : "18438494663";
    assert.ok(html.includes(`href="tel:+${phone}"`));
    assert.ok(html.includes(`href="sms:+${phone}?body=`));
    assert.match(html, /href="mailto:Carolina@hplacer.com\?subject=/);
    assert.ok(html.indexOf("JavaScript to load") > html.indexOf("</fieldset>"), "fallback stays below fields");
    assert.deepEqual(tags(html).map(tag => tag.match(/\bname="([^"]+)"/)?.[1]).sort(), contract.names.split(" ").sort());
    assert.deepEqual(tags(html).filter(tag => /\brequired=""/.test(tag)).map(tag => tag.match(/\bname="([^"]+)"/)[1]).sort(), contract.required.split(" ").sort());
  });

  test(`${key}: prehydration handler guard performs no serialization or request`, async () => {
    const driver = createFormDriver(key, {}, false);
    await driver.submit();
    assert.deepEqual(driver.calls, []);
    assert.deepEqual(driver.order, []);
  });

  test(`${key}: synchronous duplicate guard, error retention and successful retry`, async () => {
    const driver = createFormDriver(key);
    driver.form.entries = [...entries];
    if (key === "warranty") driver.form.entries.push(["summary", "Synthetic issue"]);
    if (key === "careers") driver.form.entries.push(["consent", "yes"]);
    const first = driver.submit();
    await driver.submit();
    assert.equal(driver.calls.length, 1);
    assert.deepEqual(driver.order.slice(0, 2), ["serialize", "sending"]);
    assert.equal(driver.render().status, "sending");
    driver.resolve(["warranty", "careers"].includes(key) ? response(false, { error: "Synthetic rejection" }) : "error");
    await first;
    assert.equal(driver.render().status, "error");
    assert.equal(driver.form.resets, 0);
    const retry = driver.submit();
    assert.equal(driver.calls.length, 2);
    driver.resolve(["warranty", "careers"].includes(key) ? response(true, { ok: true, reference: "fixture-ref" }) : "api");
    await retry;
    assert.equal(driver.render().status, "sent");
    assert.equal(driver.form.resets, 1);
    assert.match(driver.render().successAnnouncement, /received|set|reach out|on it|subscribed/i);
    await driver.submit();
    assert.equal(driver.calls.length, 2, "confirmed form cannot be submitted again");
  });

  test(`${key}: unexpected failure releases the lock for retry`, async () => {
    const driver = createFormDriver(key);
    driver.form.entries = [...entries];
    const first = driver.submit();
    driver.reject();
    await first;
    assert.equal(driver.render().status, "error");
    const retry = driver.submit();
    assert.equal(driver.calls.length, 2);
    driver.resolve(["warranty", "careers"].includes(key) ? response(false, { error: "Fixture" }) : "error");
    await retry;
  });
}

test("assistance keeps required email, compact fields, and unique IDs across financing instances", () => {
  const compact = render("financing", { compact: true, requireEmail: true });
  assert.match(field(compact, "email"), /required=""/);
  assert.equal(field(compact, "hasLand"), undefined);
  const html = renderToStaticMarkup(React.createElement("div", null,
    React.createElement(forms.financing), React.createElement(forms.financing, { compact: true, requireEmail: true })));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 8);
  assert.equal(ids.length, new Set(ids).size);
  for (const label of [...html.matchAll(/\bfor="([^"]+)"/g)]) assert.ok(ids.includes(label[1]));
});

test("file selection, consent and field limits remain unchanged", () => {
  const warranty = render("warranty");
  assert.match(field(warranty, "photos"), /type="file" multiple="" accept="image\/\*,application\/pdf" capture="environment"/);
  assert.match(field(warranty, "summary"), /maxLength="200"/);
  assert.match(field(warranty, "state"), /maxLength="2"/);
  const careers = render("careers");
  assert.match(field(careers, "resume"), /accept="\.pdf,\.doc,\.docx,application\/pdf,application\/msword,application\/vnd.openxmlformats-officedocument.wordprocessingml.document"/);
  assert.match(field(careers, "consent"), /type="checkbox" required=""/);
  assert.match(field(careers, "consent"), /value="yes"/);
});

for (const [key, url, fileName] of [["warranty", "/api/warranty-request", "photos"], ["careers", "/api/careers/apply", "resume"]]) {
  test(`${key}: multipart file objects and repeated entries survive unchanged`, async () => {
    const driver = createFormDriver(key);
    const file = new File(["synthetic bytes only"], "fixture.pdf", { type: "application/pdf" });
    driver.form.entries = [...entries, [fileName, file]];
    if (key === "warranty") driver.form.entries.push([fileName, new File(["another synthetic file"], "fixture-2.pdf", { type: "application/pdf" })]);
    else driver.form.entries.push(["consent", "yes"], ["position", "General application"]);
    const pending = driver.submit();
    const request = driver.calls[0];
    assert.equal(request.url, url);
    assert.equal(request.method, "POST");
    assert.equal(request.headers, undefined, "browser supplies multipart boundary");
    assert.ok(request.body instanceof FormData);
    assert.equal(await request.body.get(fileName).text(), "synthetic bytes only");
    assert.equal(request.body.get(fileName).name, "fixture.pdf");
    assert.equal(request.body.getAll(fileName).length, key === "warranty" ? 2 : 1);
    if (key === "careers") assert.equal(request.body.get("consent"), "yes");
    driver.resolve(response(false, { error: "Fixture retry" }));
    await pending;
    driver.render();
    const retry = driver.submit();
    assert.equal(await driver.calls[1].body.get(fileName).text(), "synthetic bytes only");
    assert.equal(driver.form.resets, 0);
    driver.resolve(response(true, { ok: true }));
    await retry;
  });
}

for (const key of ["financing", "service", "pricing"]) {
  test(`${key}: mailto confirmation honestly remains an unsent draft`, async () => {
    const driver = createFormDriver(key);
    driver.form.entries = [...entries];
    const pending = driver.submit();
    driver.resolve("mailto");
    await pending;
    assert.match(driver.render().successAnnouncement, /not been sent yet/);
    assert.match(renderToStaticMarkup(driver.render().confirmation), /Finish sending your/);
  });
}

test("pricing inquiry preserves model/address context and visitor note", async () => {
  for (const [props, expected] of [
    [{ model: "Fixture Model" }, { home: "Fixture Model", message: "Interested in Fixture Model — please send pricing and an estimated monthly payment." }],
    [{ model: "Fixture Model", address: "123 Synthetic Lane" }, { home: "Fixture Model (like the one at 123 Synthetic Lane)", address: "123 Synthetic Lane", message: "Interested in a home like the one at 123 Synthetic Lane." }],
  ]) {
    const driver = createFormDriver("pricing", props);
    driver.form.entries = [...entries, ["message", ""]];
    const pending = driver.submit();
    assert.equal(driver.calls[0].type, "contact");
    for (const [name, value] of Object.entries(expected)) assert.equal(driver.calls[0].data[name], value);
    driver.resolve("error");
    await pending;
  }
  const driver = createFormDriver("pricing", { model: "Fixture Model" });
  driver.form.entries = [...entries, ["message", "  Keep my synthetic note  "]];
  const pending = driver.submit();
  assert.equal(driver.calls[0].data.message, "Keep my synthetic note");
  driver.resolve("error");
  await pending;
});
