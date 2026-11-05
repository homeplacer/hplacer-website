// Real React SSR attributes are compiled exactly as HTML's native pattern rule.
// All form handlers use intercepted fixtures; no browser or external submission.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadForms, createFormDriver } from "./fixtures/public-lead-form-components.mjs";

const forms = loadForms();
const required = { financing: true, service: true, pricing: true, warranty: false, subscribe: true };
const accepted = [
  "2025550100", "(202) 555-0100", "202.555.0100", "1-202-555-0100",
  "+44 20 7946 0000", "202\t5550100", "202\u00a05550100", "1234567",
  "12345678901234567890", "202+5550100", "().---+",
];
const rejected = [
  "123456", "12", "call2025550100", "202/555/0100", "202-555-0100 ext 2",
  "202_5550100", "202\\5550100", "123456s", "💬2025550100",
];

function decodeAttribute(value) {
  // Backslashes are literal HTML characters; only character references decode.
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|quot|apos|lt|gt);/gi, (_, numeric, named) =>
    numeric
      ? String.fromCodePoint(numeric.toLowerCase().startsWith("x") ? parseInt(numeric.slice(1), 16) : Number(numeric))
      : { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[named.toLowerCase()]);
}

for (const [key, isRequired] of Object.entries(required)) {
  test(`${key}: emitted phone pattern compiles in HTML v mode and preserves accepted formats`, () => {
    const html = renderToStaticMarkup(React.createElement(forms[key]));
    const input = html.match(/<input\b[^>]*name="phone"[^>]*>/)?.[0];
    assert.ok(input, key);
    const emitted = input.match(/\bpattern="([^"]*)"/)?.[1];
    assert.ok(emitted, `${key} must keep its native formatting constraint`);
    const pattern = decodeAttribute(emitted);
    assert.doesNotThrow(() => new RegExp(pattern, "v"), "Standalone HTML pattern must compile");
    const nativePattern = new RegExp(`^(?:${pattern})$`, "v");
    for (const value of accepted) assert.equal(nativePattern.test(value), true, JSON.stringify(value));
    for (const value of rejected) assert.equal(nativePattern.test(value), false, JSON.stringify(value));
    assert.equal(/\brequired=""/.test(input), isRequired, "Preserve mandatory/optional phone fields");
    assert.match(input, /type="tel"/);
    assert.match(input, /inputMode="tel"/);
    assert.match(input, /autoComplete="tel"/);
    assert.match(input, /title="Please enter a valid phone number\."/);
    // HTML skips pattern matching for empty values. Only the retained required
    // flag blocks an empty field; optional warranty phone therefore stays empty-safe.
    assert.equal(nativePattern.test(""), false);
  });
}

test("Unicode-v repair retains the previous intended character and length rule", () => {
  const html = renderToStaticMarkup(React.createElement(forms.financing));
  const input = html.match(/<input\b[^>]*name="phone"[^>]*>/)?.[0];
  const emitted = input?.match(/\bpattern="([^"]*)"/)?.[1];
  assert.ok(emitted);
  const repaired = new RegExp(`^(?:${decodeAttribute(emitted)})$`, "v");
  const legacyIntention = /^[0-9()+.\s-]{7,}$/u;
  for (const character of ["0", "9", "(", ")", "+", ".", "-", " ", "\t", "\u00a0", "s", "\\", "/", "💬"]) {
    for (const length of [6, 7, 8]) {
      const value = character.repeat(length);
      assert.equal(repaired.test(value), legacyIntention.test(value), JSON.stringify(value));
    }
  }
});

for (const [key, type] of [["subscribe", "subscribe"], ["financing", "financing"], ["service", "service"], ["pricing", "contact"]]) {
  test(`${key}: accepted formatted phone is forwarded unchanged through the existing lead contract`, async () => {
    const driver = createFormDriver(key);
    const phone = "+44 20 7946 0000";
    driver.form.entries = [["name", "Synthetic Visitor"], ["phone", phone], ["email", "visitor@example.test"], ["company", ""]];
    const pending = driver.submit();
    await driver.submit();
    assert.equal(driver.calls.length, 1);
    assert.equal(driver.calls[0].type, type);
    assert.equal(driver.calls[0].data.phone, phone);
    driver.resolve("error");
    await pending;
    assert.equal(driver.form.resets, 0);
  });
}
