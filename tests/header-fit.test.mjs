import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const header = readFileSync("src/components/site-header.tsx", "utf8");
const tree = ts.createSourceFile("site-header.tsx", header, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const elements = [];
function visit(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
  ts.forEachChild(node, visit);
}
visit(tree);
function attribute(element, name) {
  return element.attributes.properties.find((attr) => ts.isJsxAttribute(attr) && attr.name.text === name)?.initializer;
}
function classes(element) {
  const value = attribute(element, "className");
  return value && ts.isStringLiteral(value) ? value.text.split(/\s+/) : [];
}

test("full header navigation uses a wider shell and a matching roomy breakpoint", () => {
  const shell = elements.find((element) => classes(element).includes("h-16"));
  assert.ok(shell);
  assert.ok(classes(shell).includes("max-w-[96rem]"));
  assert.ok(classes(shell).includes("w-full"));
  assert.ok(!classes(shell).includes("container-x"), "header must not inherit the narrower content shell");

  const navs = elements.filter((element) => element.tagName.getText(tree) === "nav");
  assert.equal(navs.length, 2);
  assert.ok(classes(navs[0]).includes("2xl:flex"));
  assert.ok(classes(navs[0]).includes("hidden"));
  assert.ok(classes(navs[0]).includes("shrink-0"));
  assert.ok(classes(navs[0]).includes("whitespace-nowrap"));
  assert.ok(classes(navs[1]).includes("2xl:hidden"));
  assert.doesNotMatch(header, /(?:^|\s)xl:(?:flex|inline-flex|hidden)/);

  const menuButton = elements.find((element) => element.tagName.getText(tree) === "button");
  assert.ok(classes(menuButton).includes("2xl:hidden"));
  assert.ok(classes(menuButton).includes("shrink-0"));
  assert.match(header, /aria-expanded=\{open\}/);
  assert.match(header, /onClick=\{\(\) => setOpen\(\(v\) => !v\)\}/);
});

test("Call and Email controls keep their size and text on both header variants", () => {
  const topContacts = elements.filter((element) => {
    const href = attribute(element, "href")?.getText(tree) ?? "";
    return element.tagName.getText(tree) === "a"
      && /site\.(phoneDial|email)/.test(href)
      && !classes(element).includes("mt-2");
  });
  assert.equal(topContacts.length, 4, "Call and Email are present in compact and full headers");
  for (const contact of topContacts) assert.ok(classes(contact).includes("shrink-0"));
  const fullContacts = topContacts.filter((contact) => classes(contact).includes("hidden"));
  assert.equal(fullContacts.length, 2);
  for (const contact of fullContacts) assert.ok(classes(contact).includes("2xl:inline-flex"));
  assert.ok(elements.some((element) => {
    const list = classes(element);
    return list.includes("flex") && list.includes("shrink-0") && list.includes("whitespace-nowrap") && list.includes("sm:gap-2");
  }), "contact wrapper prevents number wrapping");
  assert.match(header, /aria-label=\{`Call Home Placer at \$\{site\.phoneDisplay\}`\}/);
  assert.match(header, /aria-label="Email Home Placer"/);
});

test("every existing buyer destination remains available in both menus, with Careers in the footer", () => {
  assert.equal((header.match(/buyerNavLinks\.map\(/g) ?? []).length, 2);
  assert.match(header, /navLinks\.filter\(\(link\) => link\.href !== "\/careers"\)/);
  assert.match(header, /onClick=\{\(\) => setOpen\(false\)\}/);
  const site = readFileSync("src/lib/site.ts", "utf8");
  for (const path of ["/homes", "/brands", "/land-packages", "/recently-placed", "/financing", "/down-payment-assistance", "/warranty", "/about", "/team", "/contact"]) {
    assert.ok(site.includes(`href: "${path}"`), path);
  }
  assert.match(readFileSync("src/components/site-footer.tsx", "utf8"), /href="\/careers"/);
  assert.match(header, /<AttributionTracker \/>/, "existing attribution mount is retained");
});
