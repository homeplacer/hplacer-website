// Execute the actual client component's handlers with hook/form stubs. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const react = require("react");
const phoneBundle = await build({
  entryPoints: ["src/lib/contact-phone.ts"], bundle: true, write: false,
  platform: "node", format: "cjs", logLevel: "silent",
});
const phoneModule = { exports: {} };
runInNewContext(phoneBundle.outputFiles[0].text, {
  module: phoneModule, exports: phoneModule.exports,
});
const { CONTACT_PHONE_PATTERN, isValidContactPhone } = phoneModule.exports;
const componentBundle = await build({
  entryPoints: ["src/components/contact-form.tsx"], bundle: true, write: false,
  platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  external: ["react", "react/*"],
  plugins: [{
    name: "synthetic-contact-submit",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/lead$/ }, () => ({ path: "lead", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        contents: "export const submitLead = (type, data) => fixtureSubmit(type, data);",
        loader: "js",
      }));
    },
  }],
});

const accepted = [
  "2025550100", "(202) 555-0100", "202.555.0100", "1-202-555-0100",
  "+1 (202) 555-0100", "+44 20 7946 0000", "+1234567", "+123456789012345",
  "  +1 (202) 555-0100  ",
];
const rejected = [
  "", "   ", "\t\n", "().---", "+ ().---", "2025550", "202555010",
  "20255501000", "120255501000", "+123456", "+1234567890123456",
  "202-555-0100 ext 2", "202-555-0100x2", "call 2025550100", "202/555/0100",
  "++12025550100", "202+5550100", "\u00a0", "💬",
];

test("phone formatting pattern compiles in modern HTML v mode; guard validates digit counts", () => {
  const nativePattern = new RegExp(`^(?:${CONTACT_PHONE_PATTERN})$`, "v");
  for (const value of accepted) {
    assert.equal(nativePattern.test(value), true, `Native formatting accepts ${JSON.stringify(value)}`);
    assert.equal(isValidContactPhone(value), true, `Guard accepts ${JSON.stringify(value)}`);
  }
  for (const value of rejected) {
    assert.equal(isValidContactPhone(value), false, `Guard rejects ${JSON.stringify(value)}`);
  }
  for (const value of ["call 2025550100", "202-555-0100 ext 2", "++12025550100", "202/555/0100"]) {
    assert.equal(nativePattern.test(value), false, `Native formatting rejects ${JSON.stringify(value)}`);
  }
});

function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of react.Children.toArray(node.props?.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

function harness(phoneValue, email = "visitor@example.test") {
  const states = [];
  const refs = [];
  const updates = [];
  const requests = [];
  let stateCursor = 0;
  let refCursor = 0;
  let resolveResult;
  let rejectResult;
  const phone = { value: phoneValue, focusCount: 0, focus() { this.focusCount += 1; } };
  const values = { name: "Synthetic Visitor", phone: phoneValue, email, home: "Fixture Home", packageId: "fixture-package" };
  const form = {
    disabled: false, resetCount: 0,
    elements: { namedItem: name => name === "phone" ? phone : { value: values[name] } },
    reset() { this.resetCount += 1; },
  };
  class FixtureFormData {
    constructor(target) {
      assert.equal(target, form);
      assert.equal(target.disabled, false, "Phone and context must be captured before disabling fields");
      this.values = { ...values, phone: phone.value };
    }
    entries() { return Object.entries(this.values)[Symbol.iterator](); }
  }
  const hooks = {
    ...react,
    useId: () => "fixture",
    useSyncExternalStore: () => true,
    useEffect: () => {},
    useRef: initial => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
    useState: initial => {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => {
        states[index] = value;
        updates.push(value);
        if (index === 0) form.disabled = value === "sending";
      }];
    },
  };
  const fixtureModule = { exports: {} };
  runInNewContext(componentBundle.outputFiles[0].text, {
    module: fixtureModule, exports: fixtureModule.exports, FormData: FixtureFormData,
    require: name => name === "react" ? hooks : require(name),
    fixtureSubmit: (type, data) => {
      requests.push({ type, data: JSON.parse(JSON.stringify(data)) });
      return new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
    },
  });
  function render() {
    stateCursor = 0;
    refCursor = 0;
    return fixtureModule.exports.ContactForm({ defaultHome: "Fixture Home", packageId: "fixture-package" });
  }
  const tree = render();
  const submit = find(tree, node => node.type === "form").props.onSubmit;
  return {
    phone, requests, updates, form, render,
    submit: () => submit({ currentTarget: form, preventDefault() {} }),
    invalid: () => find(tree, node => node.type === "input" && node.props.name === "phone").props.onInvalid({
      currentTarget: phone, preventDefault() {},
    }),
    resolve: value => resolveResult(value),
    reject: () => rejectResult(new Error("Synthetic helper failure")),
  };
}

test("email cannot substitute for a missing or malformed phone, including bypassed native validation", async () => {
  for (const value of rejected) {
    const fixture = harness(value);
    await fixture.submit();
    assert.equal(fixture.requests.length, 0, JSON.stringify(value));
    assert.equal(fixture.phone.focusCount, 1);
    const tree = fixture.render();
    assert.equal(find(tree, node => node.props?.role === "alert").props.className.includes("red"), true);
    assert.equal(find(tree, node => node.type === "input" && node.props.name === "phone").props["aria-invalid"], true);
  }
});

test("native invalid events use the persistent phone error and focus without sending", () => {
  const fixture = harness("");
  fixture.invalid();
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.phone.focusCount, 1);
  assert.equal(find(fixture.render(), node => node.type === "input" && node.props.name === "phone").props["aria-invalid"], true);
});

test("phone-only inquiry captures phone/context before disable and sends one synchronous request", async () => {
  const fixture = harness("(202) 555-0100", "");
  const first = fixture.submit();
  await fixture.submit();
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.requests[0], {
    type: "contact",
    data: { name: "Synthetic Visitor", phone: "(202) 555-0100", email: "", home: "Fixture Home", packageId: "fixture-package" },
  });
  assert.equal(fixture.form.disabled, true);
  assert.equal(fixture.form.resetCount, 0);
  fixture.resolve("api");
  await first;
  assert.equal(fixture.form.resetCount, 1);
  assert.equal(fixture.updates.includes("sent"), true);
});

test("optional email is retained; failed submit preserves data and unlocks retry", async () => {
  const fixture = harness("+44 20 7946 0000");
  const first = fixture.submit();
  assert.equal(fixture.requests[0].data.email, "visitor@example.test");
  fixture.resolve("error");
  await first;
  assert.equal(fixture.form.resetCount, 0);
  assert.equal(fixture.form.disabled, false);
  const retry = fixture.submit();
  assert.equal(fixture.requests.length, 2);
  fixture.resolve("api");
  await retry;
  assert.equal(fixture.form.resetCount, 1);
});

test("unexpected helper rejection keeps the phone, permits retry, and mailto remains an unsent draft", async () => {
  const fixture = harness("202-555-0100");
  const first = fixture.submit();
  fixture.reject();
  await first;
  assert.equal(fixture.form.resetCount, 0);
  const retry = fixture.submit();
  fixture.resolve("mailto");
  await retry;
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.form.resetCount, 1);
  const heading = find(fixture.render(), node => node.type === "h3");
  assert.equal(heading.props.children, "Finish sending your inquiry");
});
