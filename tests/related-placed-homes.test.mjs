import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { projectFixture } from "./fixtures/historical-project-preview.mjs";

const published = JSON.parse(readFileSync("data/placed-homes.json", "utf8"));

function loadTs(path, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

const loadHomes = (records) => loadTs("src/lib/placed-homes.ts", {
  "../../data/placed-homes.json": records,
});
const slugs = (records) => Array.from(records, (home) => home.slug);
const fixture = (slug, fields = {}) => ({
  ...published[0],
  slug,
  town: "Conway",
  modelSlug: null,
  closeDate: null,
  ...fields,
});

function graph(records, count = 3) {
  const { relatedPlacedHomes } = loadHomes(records);
  return new Map(records.map((home) => [
    home.slug,
    slugs(relatedPlacedHomes(home.slug, home.town, count)),
  ]));
}

function reachable(links, start) {
  const visited = new Set();
  const queue = [start];
  for (const slug of queue) {
    if (visited.has(slug)) continue;
    visited.add(slug);
    queue.push(...links.get(slug));
  }
  return visited;
}

test("every published project receives detail links with only three relevant cards per page", () => {
  const links = graph(published);
  const incoming = new Map(published.map((home) => [home.slug, 0]));
  assert.equal(links.size, published.length);
  for (const [source, neighbors] of links) {
    assert.equal(neighbors.length, 3, source);
    assert.equal(new Set(neighbors).size, neighbors.length, source);
    assert.equal(neighbors.includes(source), false, source);
    for (const target of neighbors) {
      assert.ok(incoming.has(target), `Unpublished destination: ${target}`);
      incoming.set(target, incoming.get(target) + 1);
    }
  }
  for (const [slug, degree] of incoming) {
    assert.ok(degree >= 2, `${slug} needs incoming links from other details`);
  }
  // Detail navigation connects towns as well as providing inbound links.
  for (const home of published) {
    assert.equal(reachable(links, home.slug).size, published.length, home.slug);
  }
});

test("selection is deterministic across source order and does not alter published records", () => {
  const before = JSON.stringify(published);
  const original = graph(published);
  const reversed = graph([...published].reverse());
  for (const [slug, neighbors] of original) {
    assert.deepEqual(reversed.get(slug), neighbors, slug);
  }
  assert.deepEqual([...graph(published)], [...original]);
  assert.equal(JSON.stringify(published), before);
  const { getAllPlacedHomes, getPlacedHome } = loadHomes(published);
  assert.equal(getAllPlacedHomes(), published);
  for (const home of published) assert.equal(getPlacedHome(home.slug), home);
});

test("one-card navigation still reaches every project, including singleton towns", () => {
  const records = [
    fixture("conway-a"),
    fixture("conway-b"),
    fixture("loris-only", { town: "Loris" }),
    fixture("myrtle-only", { town: "Myrtle Beach" }),
  ];
  const links = graph(records, 1);
  for (const [slug, neighbors] of links) {
    assert.equal(neighbors.length, 1, slug);
    assert.equal(reachable(links, slug).size, records.length, slug);
  }
});

test("the remaining card prefers the same town, then a known model match", () => {
  const records = [
    fixture("current", { closeDate: "2025-01-20", modelSlug: "model-a" }),
    fixture("newer-neighbor", { closeDate: "2025-01-21", modelSlug: "model-b" }),
    fixture("older-neighbor", { closeDate: "2025-01-19", modelSlug: "model-c" }),
    fixture("same-model", { closeDate: "2025-01-01", modelSlug: "model-a" }),
    fixture("closer-other-model", { closeDate: "2025-01-18", modelSlug: "model-c" }),
    fixture("other-town-model", { town: "Loris", closeDate: "2025-01-20", modelSlug: "model-a" }),
  ];
  const { relatedPlacedHomes } = loadHomes(records);
  assert.deepEqual(slugs(relatedPlacedHomes("current", "Conway")), [
    "same-model", "newer-neighbor", "older-neighbor",
  ]);
});

test("date proximity fills the remaining card when the model is unknown", () => {
  const records = [
    fixture("current", { closeDate: "2025-01-10" }),
    fixture("next", { closeDate: "2025-01-09" }),
    fixture("previous", { closeDate: "2025-01-11" }),
    fixture("closer", { closeDate: "2025-01-07", modelSlug: "known-model" }),
    fixture("farther", { closeDate: "2025-01-01" }),
    fixture("missing-date"),
    fixture("invalid-date", { closeDate: "not-a-date" }),
  ];
  const { relatedPlacedHomes } = loadHomes(records);
  assert.deepEqual(slugs(relatedPlacedHomes("current", "Conway")), [
    "previous", "next", "closer",
  ]);
});

test("missing dates, tied dates, and unknown towns retain stable navigation", () => {
  const records = [
    fixture("z", { town: "Unknown" }),
    fixture("a", { town: "Unknown", closeDate: "invalid" }),
    fixture("c", { town: "Unknown" }),
    fixture("b", { town: "Unknown" }),
  ];
  const { relatedPlacedHomes } = loadHomes(records);
  assert.deepEqual(slugs(relatedPlacedHomes("a", "Unknown")), ["b", "c", "z"]);
  for (const count of [1, 2, 3]) {
    const links = graph(records, count);
    for (const home of records) assert.equal(reachable(links, home.slug).size, records.length);
  }
});

test("empty, singleton, duplicate URL, unknown source and limit cases stay compact", () => {
  assert.equal(loadHomes([]).relatedPlacedHomes("missing", "Conway").length, 0);
  assert.equal(loadHomes([fixture("only")]).relatedPlacedHomes("only", "Conway").length, 0);
  const records = [fixture("a"), fixture("b"), fixture("a", { town: "Loris" }), fixture("c")];
  const before = JSON.stringify(records);
  const { relatedPlacedHomes, getAllPlacedHomes, getPlacedHome } = loadHomes(records);
  assert.equal(getAllPlacedHomes(), records);
  assert.equal(getAllPlacedHomes().length, 4, "source records must not be deduplicated");
  assert.equal(getPlacedHome("a"), records[0]);
  const links = graph(records, 1);
  for (const slug of links.keys()) assert.equal(reachable(links, slug).size, 3);
  assert.deepEqual(slugs(relatedPlacedHomes("b", "Conway")), ["a", "c"]);
  assert.equal(relatedPlacedHomes("b", "Conway")[0], records[0]);
  assert.equal(JSON.stringify(records), before);
  assert.equal(relatedPlacedHomes("missing", "Conway").length, 0);
  for (const count of [0, -1, 0.5, NaN, Infinity]) {
    assert.equal(relatedPlacedHomes("b", "Conway", count).length, 0);
  }
  assert.equal(relatedPlacedHomes("b", "Conway", 1.5).length, 1);
  assert.equal(loadHomes(published).relatedPlacedHomes(published[0].slug, published[0].town, 100).length, 3);
  assert.deepEqual(slugs(loadHomes([fixture("a"), fixture("b")]).relatedPlacedHomes("a", "Conway")), ["b"]);
});

test("the detail page renders crawlable neighbor links and honest town/Sold labels", async () => {
  const homes = loadHomes(published);
  const empty = () => null;
  const icons = Object.fromEntries([
    "BedIcon", "BathIcon", "RulerIcon", "PinIcon", "PhoneIcon", "ArrowIcon", "CheckIcon",
  ].map((name) => [name, empty]));
  const { default: DetailPage } = loadTs("src/app/recently-placed/[slug]/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": ({ href, className, children }) => createElement("a", { href, className }, children),
    "next/navigation": { notFound: () => assert.fail("Expected published project") },
    "@/components/project-evidence": { ProjectEvidence: empty },
    "@/components/historical-project-card": { HistoricalProjectCard: projectFixture.HistoricalProjectCard },
    "@/lib/historical-project-images": { relatedProjectImageSizes: projectFixture.relatedProjectImageSizes },
    "@/lib/metadata": { pageMetadata: (value) => value },
    "@/lib/placed-homes": homes,
    "@/lib/homes": { getHome: () => undefined, formatPrice: (value) => String(value) },
    "@/components/home-gallery": { HomeGallery: empty },
    "@/components/want-this-house-form": { WantThisHouseForm: empty },
    "@/lib/jsonld": {
      JsonLd: empty, breadcrumbLd: empty, placedHomeLd: empty, placedHomeResidenceLd: empty,
    },
    "@/lib/asset": { asset: (value) => value },
    "@/lib/placed-home-metadata": { placedHomeMetadata: empty },
    "@/lib/site": { site: { phoneDial: "+18438494663", phoneDisplay: "(843) 849-HOME" } },
    "@/components/icons": icons,
  });
  const singleton = published.find((home) => home.town === "Myrtle Beach");
  const local = published.find((home) => homes.relatedPlacedHomes(home.slug, home.town).every((other) => other.town === home.town));
  for (const home of [singleton, local]) {
    const html = renderToStaticMarkup(await DetailPage({ params: Promise.resolve({ slug: home.slug }) }));
    const section = html.slice(html.indexOf("More homes we"));
    const neighbors = homes.relatedPlacedHomes(home.slug, home.town);
    assert.deepEqual(Array.from(section.matchAll(/href="\/recently-placed\/([^"]+)"/g), (match) => match[1]), slugs(neighbors));
    for (const neighbor of neighbors) assert.ok(section.includes(`${neighbor.town}, SC · Sold`));
    assert.equal(section.includes(` in ${home.town}</h2>`), home === local);
  }
});
