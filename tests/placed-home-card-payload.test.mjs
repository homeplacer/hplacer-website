import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(path, "utf8");
const published = JSON.parse(read("data/placed-homes.json"));
const componentSource = read("src/components/placed-homes.tsx");
const fields = ["slug", "address", "town", "beds", "baths", "style", "price", "photo", "modelName", "lotAcres", "closeDate"];

function load(source, imports = {}) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const testModule = { exports: {} };
  runInNewContext(outputText, {
    module: testModule,
    exports: testModule.exports,
    require: (name) => {
      if (name in imports) return imports[name];
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return testModule.exports;
}

const { toPlacedHomeCard } = load(read("src/lib/placed-home-card.ts"));
const asset = load(read("src/lib/asset.ts"));
const { getAllPlacedHomes, getPlacedHome } = load(read("src/lib/placed-homes.ts"), {
  "../../data/placed-homes.json": published,
});
const jsxImports = {
  "next/link": (props) => React.createElement("a", props),
  "@/lib/asset": asset,
  "@/components/icons": { PinIcon: (props) => React.createElement("svg", props) },
};
function render(cards, sort = "recent") {
  const { PlacedHomes } = load(componentSource, {
    ...jsxImports,
    react: { ...React, useState: () => [sort, () => {}] },
  });
  return renderToStaticMarkup(React.createElement(PlacedHomes, { homes: cards }));
}
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const slugsIn = (html) => [...html.matchAll(/<a\b[^>]*href="\/recently-placed\/([^"]+)"/g)].map((match) => match[1]);
const fixture = (slug, fields = {}) => ({ ...published[0], slug, ...fields });

test("every source record becomes one complete card summary without changing gallery records or order", () => {
  const before = JSON.stringify(published);
  const cards = getAllPlacedHomes().map(toPlacedHomeCard);
  assert.equal(cards.length, published.length);
  assert.deepEqual(cards.map((card) => card.slug), published.map((home) => home.slug));
  for (let i = 0; i < published.length; i++) {
    const home = published[i];
    const card = cards[i];
    assert.deepEqual({ ...card }, {
      ...Object.fromEntries(fields.map((field) => [field, home[field]])),
      photoCount: home.photos.length,
    });
    assert.equal(getPlacedHome(home.slug), home, "detail lookup retains the complete original record");
    assert.equal(getPlacedHome(home.slug).photos, home.photos, "full galleries are not replaced or truncated");
  }
  assert.equal(JSON.stringify(published), before);
  assert.equal(getAllPlacedHomes(), published);
});

test("the projection retains every card/sorter field but never transfers gallery arrays or unused record fields", () => {
  const tree = ts.createSourceFile("placed-homes.tsx", componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reads = new Set();
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(tree) === "h") reads.add(node.name.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.deepEqual([...reads].sort(), [...fields, "photoCount"].sort());
  const frozen = Object.freeze({ ...published[0], photos: Object.freeze([...published[0].photos]) });
  const card = toPlacedHomeCard(frozen);
  assert.notEqual(card, frozen);
  assert.deepEqual(Object.keys(card).sort(), [...fields, "photoCount"].sort());
  assert.equal(card.photoCount, frozen.photos.length);
  for (const field of ["photos", "mls", "townSlug", "withLand", "lat", "lon", "modelSlug", "sqftHeated"]) {
    assert.equal(Object.hasOwn(card, field), false, field);
  }
});

test("recent sorting renders all original links, photos, accessible descriptions, and counts", () => {
  const cards = published.map(toPlacedHomeCard);
  const inputOrder = cards.map((card) => card.slug);
  const html = render(cards);
  const expected = [...published].sort((a, b) => (b.closeDate || "").localeCompare(a.closeDate || ""));
  assert.deepEqual(slugsIn(html), expected.map((home) => home.slug));
  assert.deepEqual(cards.map((card) => card.slug), inputOrder, "sorting does not mutate the projected input");
  assert.equal((html.match(/loading="eager"/g) ?? []).length, Math.min(6, published.length));
  assert.equal((html.match(/loading="lazy"/g) ?? []).length, Math.max(0, published.length - 6));
  for (const home of published) {
    assert.ok(html.includes(`src="${escape(asset.asset(home.photo))}"`), home.slug);
    assert.ok(html.includes(`alt="${escape(`A Home Placer manufactured home placed at ${home.address}, ${home.town}, SC`)}"`), home.slug);
    assert.ok(html.includes(escape(home.address)), home.slug);
    assert.ok(html.includes(`$${home.price.toLocaleString("en-US")}`), home.slug);
    if (home.photos.length > 1) assert.ok(html.includes(`${home.photos.length} photos`), home.slug);
  }
});

test("city sorting retains newest-first city groups, original cards, and the shared eager-image limit", () => {
  const records = [
    fixture("older", { town: "Conway", closeDate: "2025-01-01" }),
    fixture("other-town", { town: "Myrtle Beach", closeDate: "2026-02-01" }),
    fixture("undated", { town: "Unknown", closeDate: null }),
    fixture("newest", { town: "Conway", closeDate: "2026-03-01" }),
  ];
  const cards = records.map(toPlacedHomeCard);
  assert.deepEqual(slugsIn(render(cards)), ["newest", "other-town", "older", "undated"]);
  const html = render(cards, "city");
  assert.deepEqual(slugsIn(html), ["newest", "older", "other-town", "undated"]);
  assert.deepEqual([...html.matchAll(/<h2\b[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]), ["Conway", "Myrtle Beach", "Unknown"]);
  assert.match(html, /2 homes sold/);
  assert.match(html, /1 home sold/);
  assert.equal((html.match(/loading="eager"/g) ?? []).length, records.length);
  assert.deepEqual(cards.map((card) => card.slug), records.map((home) => home.slug));
});

test("keyboard focus outlines stay inset inside the overflow-clipped directory cards in both sort views", () => {
  const cards = published.map(toPlacedHomeCard);
  for (const sort of ["recent", "city"]) {
    const html = render(cards, sort);
    const links = [...html.matchAll(/<li class="([^"]+)"><a\b([^>]*)>/g)];
    assert.equal(links.length, cards.length, sort);
    for (const [, parentClasses, attributes] of links) {
      assert.match(parentClasses, /\boverflow-hidden\b/);
      const classes = /class="([^"]+)"/.exec(attributes)?.[1].split(" ") ?? [];
      assert.ok(classes.includes("focus-visible:outline-2"));
      assert.ok(classes.includes("focus-visible:outline-brand-700"));
      // A positive offset places the entire 2px indicator outside the Link,
      // where its overflow-hidden parent clips it. Keep the outline inset.
      assert.ok(classes.includes("focus-visible:-outline-offset-2"));
      assert.equal(classes.some(name => /^focus-visible:outline-offset-/.test(name)), false);
    }
  }
});

test("zero/single/multiple photos and missing optional values preserve badge and label behavior", () => {
  for (const [photos, count] of [[[], 0], [["/one.jpg"], 1], [["/one.jpg", "/two.jpg"], 2]]) {
    const card = toPlacedHomeCard(fixture("badge", { photos, closeDate: null, modelName: null, lotAcres: null }));
    assert.equal(card.photoCount, count);
    const html = render([card]);
    assert.match(html, />Sold<\/span>/);
    assert.doesNotMatch(html, /Model:| ac</);
    if (count > 1) assert.match(html, /2 photos/);
    else assert.doesNotMatch(html, /\d+ photos/);
  }
  for (const sort of ["recent", "city"]) {
    const html = render([], sort);
    assert.deepEqual(slugsIn(html), []);
    assert.match(html, /Most recent/);
    assert.match(html, /By city/);
  }
});

test("only the grid receives card summaries; schema, maps, and complete gallery pages keep original records", () => {
  const page = read("src/app/recently-placed/page.tsx");
  assert.match(page, /<PlacedHomes homes=\{homes\.map\(toPlacedHomeCard\)\} \/>/);
  assert.match(page, /placedHomesGalleryLd\(homes\)/);
  assert.match(page, /getNewClosedHomePlacerSales\(homes\)/);
  assert.match(page, /<PlacementsMap points=\{points\}/);
  assert.doesNotMatch(read("src/lib/placed-homes.ts"), /toPlacedHomeCard|photoCount/);
  assert.doesNotMatch(read("src/app/recently-placed/[slug]/page.tsx"), /toPlacedHomeCard|photoCount/);
});
