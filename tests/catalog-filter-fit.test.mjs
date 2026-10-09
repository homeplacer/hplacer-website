import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync("src/components/homes-browser.tsx", "utf8");

function load(sourceText, imports = {}) {
  const { outputText } = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
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

const types = load(readFileSync("src/lib/home-types.ts", "utf8"));
const { HomesBrowser } = load(source, {
  "@/lib/home-types": types,
  "@/components/home-card": { HomeCard: ({ home }) => React.createElement("article", null, home.name) },
});
const home = {
  id: 1, slug: "test-home", name: "Test home", brand: "Clayton", series: "Test",
  modelCode: "test", widthFt: 16, lengthFt: 76, sqft: 1216, beds: 3, baths: 2,
  description: "", excerpt: "", decorOptions: [], imageUrls: [], setupPrice: 199999,
};
const htmlFor = (homes) => renderToStaticMarkup(React.createElement(HomesBrowser, { homes }));
const pricedHtml = htmlFor([home]);
const select = (html, label) => html.match(new RegExp(`<select\\b[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?<\\/select>`))?.[0];

test("the package-price pair stacks on phones and retains the desktop inline layout", () => {
  const group = pricedHtml.match(/<div class="([^"]+)">(<select aria-label="Minimum land-home estimate"[\s\S]*?)<\/div>/);
  assert.ok(group, "both price controls remain together");
  const classes = group[1].split(/\s+/);
  for (const token of ["grid", "w-full", "min-w-0", "grid-cols-1", "sm:inline-flex", "sm:w-auto", "sm:items-center"]) {
    assert.ok(classes.includes(token), token);
  }
  for (const label of ["Minimum land-home estimate", "Maximum land-home estimate"]) {
    const control = select(group[2], label);
    assert.ok(control, label);
    for (const token of ["min-w-0", "w-full", "sm:w-auto"]) assert.ok(control.includes(token), `${label}: ${token}`);
  }
  assert.match(group[2], /<span class="hidden text-stone-muted sm:inline">–<\/span>/);
  assert.doesNotMatch(source, /overflow-x-hidden|overflow-hidden|tabIndex=\{-1\}/, "fit must not hide overflow or remove keyboard access");
});

test("all native filter controls keep their accessible labels, defaults, and options", () => {
  const labels = [...pricedHtml.matchAll(/<select\b[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Bedrooms", "Min square feet", "Max square feet", "Minimum land-home estimate", "Maximum land-home estimate", "Sort"]);
  for (const [label, text] of [
    ["Bedrooms", "Any beds"], ["Min square feet", "Min sqft"], ["Max square feet", "Max sqft"],
    ["Minimum land-home estimate", "Min package price"], ["Maximum land-home estimate", "Max package price"],
    ["Sort", "Best selling"],
  ]) {
    assert.match(select(pricedHtml, label), new RegExp(`<option value="(?:0|best)" selected="">${text}<\\/option>`), label);
  }
  for (const label of ["Minimum land-home estimate", "Maximum land-home estimate"]) {
    const prices = [...select(pricedHtml, label).matchAll(/<option value="(\d+)"/g)].map((match) => Number(match[1]));
    assert.deepEqual(prices, [0, 175000, 180000, 190000, 200000, 220000, 240000, 260000, 280000, 300000]);
  }
  for (const text of ["All", "Clayton", "All widths", "Single-wide", "Double-wide", "32′ XL", "Full drywall"]) {
    assert.ok(pricedHtml.includes(text), text);
  }
  assert.match(pricedHtml, /aria-label="Search homes"/);
  assert.match(pricedHtml, /Price: low to high/);
  assert.match(pricedHtml, /Price: high to low/);
});

test("price filters remain conditional rather than becoming empty controls", () => {
  const unpricedHtml = htmlFor([{ ...home, setupPrice: undefined }]);
  const emptyHtml = htmlFor([]);
  for (const html of [unpricedHtml, emptyHtml]) {
    assert.ok(select(html, "Bedrooms"));
    assert.ok(select(html, "Min square feet"));
    assert.ok(select(html, "Max square feet"));
    assert.ok(select(html, "Sort"));
    assert.equal(select(html, "Minimum land-home estimate"), undefined);
    assert.equal(select(html, "Maximum land-home estimate"), undefined);
    assert.doesNotMatch(html, /Price: low to high|Price: high to low/);
  }
  assert.match(emptyHtml, /No homes match your search/);
  assert.match(emptyHtml, /Clear filters/);
});

test("catalog SSR names its floor-plan section before real card headings and retains shopping content", () => {
  const fixtures = [
    { ...home, price: 134999, bestSellerRank: 0 },
    { ...home, id: 2, slug: "home-only-plan", name: "Home-only plan", brand: "Cavco", setupPrice: undefined, price: 159999, bestSellerRank: 1 },
  ];
  const Link = ({ children, ...props }) => React.createElement("a", props, children);
  const icons = load(readFileSync("src/components/icons.tsx", "utf8"));
  const { FallbackImage } = load(readFileSync("src/components/fallback-image.tsx", "utf8"));
  const galleryImages = load(readFileSync("src/lib/model-gallery-images.ts", "utf8"), {
    "./model-gallery-assets.json": {},
  });
  const { HomeCard } = load(readFileSync("src/components/home-card.tsx", "utf8"), {
    "next/link": { default: Link },
    "@/lib/home-types": types,
    "@/components/icons": icons,
    "@/components/fallback-image": { FallbackImage },
    "@/lib/model-gallery-images": galleryImages,
    "@/lib/site": { site: { phoneDial: "+15555550100" } },
    "@/components/home-inquiry-dialog": {
      HomeInquiryDialog: ({ label }) => React.createElement("button", { type: "button" }, label),
    },
  });
  const { HomesBrowser: CatalogBrowser } = load(source, {
    "@/lib/home-types": types,
    "@/components/home-card": { HomeCard },
  });
  // Use the real page, browser, and cards; providers and lead dialogs stay offline.
  const { default: HomesPage } = load(readFileSync("src/app/homes/page.tsx", "utf8"), {
    "next/link": { default: Link },
    "@/lib/metadata": { pageMetadata: (metadata) => metadata },
    "@/lib/homes": { getAllHomes: () => fixtures },
    "@/components/homes-browser": { HomesBrowser: CatalogBrowser },
    "@/lib/jsonld": { JsonLd: () => null, homesItemListLd: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(HomesPage));
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([^<]+)<\/h\1>/g)]
    .map(([, level, text]) => [Number(level), text.trim()]);
  assert.deepEqual(headings, [
    [1, "Find your home"],
    [2, "Floor plans"],
    [3, "Test home"],
    [3, "Home-only plan"],
  ]);
  assert.match(html, /<section class="container-x py-10" aria-labelledby="homes-catalog-heading"><h2 id="homes-catalog-heading" class="sr-only">Floor plans<\/h2>/);
  assert.equal((html.match(/id="homes-catalog-heading"/g) ?? []).length, 1);
  for (const fixture of fixtures) {
    assert.ok(html.includes(`href="/homes/${fixture.slug}"`), fixture.slug);
    assert.ok(html.includes(`aria-label="View ${fixture.name} details and request pricing"`), fixture.name);
  }
  for (const price of ["$199,999", "$134,999", "$159,999"]) assert.ok(html.includes(price), price);
  assert.match(html, /est\. land \+ home/);
  assert.match(html, /home only/);
  assert.match(html, /browse current land-home packages/);
  assert.match(html, /quarter-acre lot/);
  assert.match(html, /aria-label="Search homes"/);
  assert.deepEqual(
    [...html.matchAll(/<select\b[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]),
    ["Bedrooms", "Min square feet", "Max square feet", "Minimum land-home estimate", "Maximum land-home estimate", "Sort"],
  );
});
