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
function load(source, imports) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const testModule = { exports: {} };
  runInNewContext(outputText, {
    module: testModule, exports: testModule.exports,
    require: (specifier) => {
      if (specifier in imports) return imports[specifier];
      if (specifier === "react" || specifier === "react/jsx-runtime") return require(specifier);
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return testModule.exports;
}
const photoHelpers = load(read("src/lib/mls-photo.ts"), {});
const { MlsPackagePhoto } = load(read("src/components/mls-package-photo.tsx"), { "@/lib/mls-photo": photoHelpers });
const feed = load(read("src/lib/forturro-package-feed.ts"), {
  "next/cache": { unstable_cache: (fn) => fn },
  "./mls-photo": photoHelpers,
});
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const navigationSource = read("src/components/live-package-navigation.tsx");
const { packageNeighbors, LivePackageNavigation } = load(navigationSource, {
  "next/link": { default: Link },
  "@/lib/forturro-package-feed": { packageSlug: feed.packageSlug },
});
const sample = (number, changes = {}) => ({
  listingKey: `fixture-${number}`, address: `${number} Example Road`, city: "Fixture Town",
  listPrice: 200000 + number, beds: 3, baths: 2, ...changes,
});
const slugs = (listings) => Array.from(listings, feed.packageSlug);

test("zero, one, and unknown current packages have no fabricated or self navigation", () => {
  assert.equal(packageNeighbors([], "missing").length, 0);
  const one = sample(1);
  assert.equal(packageNeighbors([one], feed.packageSlug(one)).length, 0);
  assert.equal(packageNeighbors([one, sample(2)], "missing").length, 0);
  assert.equal(renderToStaticMarkup(React.createElement(LivePackageNavigation, { listings: [one], currentSlug: feed.packageSlug(one) })), "");
});

test("two packages link to each other exactly once", () => {
  const listings = [sample(1), sample(2)];
  for (const current of listings) {
    const neighbors = packageNeighbors(listings, feed.packageSlug(current));
    assert.equal(neighbors.length, 1);
    assert.notEqual(feed.packageSlug(neighbors[0]), feed.packageSlug(current));
  }
});

test("every package has another detail entry path for many-record snapshots without mutating source order", () => {
  for (const count of [3, 4, 20, 120]) {
    const listings = Array.from({ length: count }, (_, index) => Object.freeze(sample(index + 1))).reverse();
    const before = JSON.stringify(listings);
    Object.freeze(listings);
    const incoming = new Map(slugs(listings).map((slug) => [slug, 0]));
    for (const current of listings) {
      const currentSlug = feed.packageSlug(current);
      const neighbors = packageNeighbors(listings, currentSlug);
      assert.equal(neighbors.length, 2);
      assert.equal(new Set(slugs(neighbors)).size, neighbors.length);
      for (const slug of slugs(neighbors)) {
        assert.notEqual(slug, currentSlug);
        incoming.set(slug, incoming.get(slug) + 1);
      }
    }
    for (const [slug, links] of incoming) assert.ok(links > 0, `${count}: ${slug}`);
    assert.equal(JSON.stringify(listings), before);
  }
});

test("route and MLS-key duplicates do not create repeated links or aliases of the current property", () => {
  const one = sample(1);
  const duplicateRoute = sample(91, { address: "1 Example Road.", listPrice: 999999 });
  const duplicateKey = sample(92, { listingKey: one.listingKey });
  const second = sample(2);
  const third = sample(3);
  const listings = [one, duplicateRoute, duplicateKey, second, third];
  const forFirst = packageNeighbors(listings, feed.packageSlug(one));
  assert.deepEqual(slugs(forFirst).sort(), slugs([second, third]).sort());
  const forSecond = packageNeighbors(listings, feed.packageSlug(second));
  assert.equal(new Set(forSecond.map((listing) => listing.listingKey)).size, forSecond.length);
  const linkedFirst = forSecond.find((listing) => feed.packageSlug(listing) === feed.packageSlug(one));
  if (linkedFirst) assert.equal(linkedFirst.listPrice, one.listPrice);
  const otherTown = sample(93, { address: one.address, city: "Different Fixture Town" });
  assert.equal(packageNeighbors([one, otherTown], feed.packageSlug(one)).length, 1);
});

test("invalid display records cannot become advertised navigation targets", () => {
  const one = sample(1), two = sample(2);
  const listings = [
    one, two, {}, null, sample(3, { address: " " }), sample(4, { city: "" }),
    sample(5, { listingKey: "" }), sample(6, { listPrice: 0 }),
    sample(7, { listPrice: -1 }), sample(8, { listPrice: NaN }), sample(9, { listPrice: Infinity }),
  ];
  assert.deepEqual(slugs(packageNeighbors(listings, feed.packageSlug(one))), slugs([two]));
});

test("removed records stay absent when the existing eligible active snapshot changes", () => {
  const one = sample(1), removed = sample(2), three = sample(3);
  assert.ok(slugs(packageNeighbors([one, removed, three], feed.packageSlug(one))).includes(feed.packageSlug(removed)));
  assert.deepEqual(slugs(packageNeighbors([one, three], feed.packageSlug(one))), slugs([three]));
  assert.equal(packageNeighbors([one, three], feed.packageSlug(removed)).length, 0);
  assert.doesNotMatch(navigationSource, /\bfetch\(|Date\.now|new Date|process\.env|registry|placed-homes|land-home-packages\.json/);
});

test("navigation renders local canonical package anchors and qualified current prices without a client inventory payload", () => {
  const listings = [sample(1), sample(2), sample(3)];
  const html = renderToStaticMarkup(React.createElement(LivePackageNavigation, { listings, currentSlug: feed.packageSlug(listings[0]) }));
  assert.match(html, /<nav aria-label="Other current land-home packages"/);
  for (const listing of listings.slice(1)) {
    assert.ok(html.includes(`href="/land-packages/${feed.packageSlug(listing)}"`));
    assert.ok(html.includes(listing.address));
  }
  assert.doesNotMatch(html, /href="https?:|<img|<script|\?model=/);
  assert.match(html, /confirm its availability and included scope/);
  assert.match(html, /Current MLS list price/);
  assert.doesNotMatch(navigationSource, /["']use client["']/);
});

test("the detail uses one existing live snapshot for its current listing and related navigation", async () => {
  const listings = [sample(1), sample(2), sample(3)];
  let reads = 0;
  const icon = () => React.createElement("svg", { "aria-hidden": true });
  const notFoundSignal = new Error("fixture not found");
  const page = load(read("src/app/land-packages/[slug]/page.tsx"), {
    "next/link": { default: Link },
    "next/navigation": { notFound: () => { throw notFoundSignal; } },
    "@/components/home-inquiry-dialog": { HomeInquiryDialog: ({ label }) => React.createElement("button", null, label) },
    "@/components/live-package-navigation": { LivePackageNavigation },
    "@/components/mls-package-photo": { MlsPackagePhoto },
    "@/components/icons": { BathIcon: icon, BedIcon: icon, PhoneIcon: icon, RulerIcon: icon },
    "@/lib/jsonld": { JsonLd: () => null, breadcrumbLd: () => ({}) },
    "@/lib/forturro-package-feed": {
      getLivePackageListings: async () => { reads++; return listings; },
      getLivePackageBySlug: () => { throw new Error("The page must not load a second inventory snapshot"); },
      packageSlug: feed.packageSlug,
    },
    "@/lib/metadata": { pageMetadata: (metadata) => metadata },
    "@/lib/site": { site: { url: "https://hplacer.com", phoneDial: "+18438494663", phoneDisplay: "(843) 849-HOME" } },
  });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: feed.packageSlug(listings[0]) }) }));
  assert.equal(reads, 1);
  assert.match(html, /Ask about this home/);
  assert.match(html, /href="tel:\+18438494663"/);
  assert.ok(html.indexOf("Request details or a visit") < html.indexOf("Compare other current packages"));
  for (const listing of listings.slice(1)) assert.ok(html.includes(`href="/land-packages/${feed.packageSlug(listing)}"`));
  await assert.rejects(page.default({ params: Promise.resolve({ slug: "removed-fixture" }) }), (error) => error === notFoundSignal);
  assert.equal(page.revalidate, 300);
});
