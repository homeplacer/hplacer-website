import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync("src/lib/contact-context.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
);
const { contactContextHref, contactHomeFromLocation } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("new contextual inquiry URLs use one contact route and round-trip model names", () => {
  for (const home of ["Ultra Flex", "Myrtle Beach area", "Café & Home + Land #1 / 28×52?", "家 🏠"]) {
    const href = contactContextHref(home);
    const url = new URL(href, "https://hplacer.com");
    assert.equal(url.pathname, "/contact");
    assert.equal(url.search, "");
    assert.equal(url.hash, `#home=${encodeURIComponent(home)}`);
    assert.equal(contactHomeFromLocation(url), home);
  }
  assert.equal(contactContextHref(""), "/contact");
  assert.equal(contactContextHref("  "), "/contact");
});

test("legacy links still prefill; new fragment context wins when both exist", () => {
  assert.equal(contactHomeFromLocation({ hash: "", search: "?home=Ultra+Flex&campaign=old" }), "Ultra Flex");
  assert.equal(contactHomeFromLocation({ hash: "", search: "?home=Caf%C3%A9%20%26%20Land" }), "Café & Land");
  assert.equal(contactHomeFromLocation({ hash: "#home=Beacon", search: "?home=Ultra%20Flex" }), "Beacon");
  assert.equal(contactHomeFromLocation({ hash: "#home=", search: "?home=Legacy" }), "Legacy");
  assert.equal(contactHomeFromLocation({ hash: "#other=ignored", search: "?home=Legacy" }), "Legacy");
  assert.equal(contactHomeFromLocation({ hash: "", search: "?%68ome=Encoded+key" }), "Encoded key");
});

test("empty and malformed context safely leave default form context available", () => {
  for (const location of [
    { hash: "", search: "" },
    { hash: "#home=", search: "?home=" },
    { hash: "#home=%20%20", search: "" },
    { hash: "#home", search: "" },
    { hash: "#home=%E0%A4%A", search: "" },
    { hash: "", search: "?home=bad%" },
    { hash: "#home=%FF", search: "?home=%FF" },
  ]) {
    assert.equal(contactHomeFromLocation(location), undefined, JSON.stringify(location));
  }
  assert.equal(contactHomeFromLocation({ hash: "#home=bad%", search: "?home=Legacy" }), "Legacy");
  assert.equal(contactHomeFromLocation({ hash: "#broken%=value&home=Beacon", search: "" }), "Beacon");
});

test("dialogs and location links share the fragment helper without changing lead contracts", () => {
  const dialog = readFileSync("src/components/home-inquiry-dialog.tsx", "utf8");
  const location = readFileSync("src/app/locations/[slug]/page.tsx", "utf8");
  const form = readFileSync("src/components/contact-form.tsx", "utf8");
  assert.match(dialog, /href=\{contactContextHref\(homeName\)\}/);
  assert.match(location, /href=\{contactContextHref\(loc\.name \+ " area"\)\}/);
  assert.doesNotMatch(dialog + location, /\/contact\?home=/);
  assert.match(dialog, /event\.preventDefault\(\)/);
  assert.match(dialog, /<ContactForm defaultHome=\{homeName\} \/>/);
  assert.match(form, /useState\(defaultHome\)/);
  assert.match(form, /contactHomeFromLocation\(window\.location\)/);
  assert.match(form, /addEventListener\("hashchange", prefillHome\)/);
  assert.match(form, /removeEventListener\("hashchange", prefillHome\)/);
  assert.match(form, /name="home"[\s\S]*?value=\{home\}/);
  assert.match(form, /name="packageId" value=\{packageId\}/);
  assert.match(form, /submitLead\("contact", data\)/);
  assert.match(readFileSync("src/app/contact/page.tsx", "utf8"), /canonical: "\/contact"/);
});
