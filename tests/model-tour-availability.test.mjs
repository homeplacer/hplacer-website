import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import * as react from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const models = json("data/models.json");
const deadTours = {
  "dutch-elite-1676-01": "4YJzwgZWJMZ",
  "dutch-elite-1676-07": "Hdjs5Whevk7",
};
const replacement = "https://my.matterport.com/show/?m=sFnvNkUWzgV";

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    compiled,
    compiled.exports,
  );
  return compiled.exports;
}

const availability = load("src/lib/model-tour-availability.ts");
const types = load("src/lib/home-types.ts");
const mediaPolicy = load("src/lib/media-policy.ts");
const assets = load("src/lib/asset.ts");
function catalog(records = models) {
  return load("src/lib/homes.ts", {
    "./home-types": types,
    "./asset": assets,
    "./model-tour-availability": availability,
    "../../data/models.json": records,
    "../../data/setup-pricing.json": json("data/setup-pricing.json"),
    "../../data/home-pricing.json": json("data/home-pricing.json"),
  });
}

test("only two confirmed dead tours are withheld from every catalog projection without mutating source records", () => {
  const before = structuredClone(models);
  const homes = catalog();
  for (const model of models) {
    const expected = Object.hasOwn(deadTours, model.slug) ? undefined : model.tourUrl;
    assert.equal(homes.getHome(model.slug).tourUrl, expected, model.slug);
    for (const home of [
      ...homes.getAllHomes(),
      ...homes.getHomesByBrand(model.brand),
      ...homes.bestSellerHomes(),
      ...homes.fullDrywallHomes(),
      ...homes.featuredHomes(),
    ].filter((home) => home.slug === model.slug)) {
      assert.equal(home.tourUrl, expected, model.slug);
    }
  }
  for (const [slug, id] of Object.entries(deadTours)) {
    assert.equal(models.find((model) => model.slug === slug).tourUrl, `https://my.matterport.com/show/?m=${id}`);
    assert.equal(JSON.stringify(homes.getHome(slug)).includes(id), false);
  }
  assert.deepEqual(models, before);
  assert.equal(homes.getHome("tradition-68").tourUrl, replacement);
});

test("exceptions follow exact Matterport source identity despite query, hash, encoded ID or entity changes", () => {
  for (const [slug, id] of Object.entries(deadTours)) {
    for (const source of [
      `https://my.matterport.com/show/?m=${id}`,
      `https://my.matterport.com/show?play=1&m=${id}#view`,
      `https://my.matterport.com/show/?play=1&#038;m=${id}`,
      `https://my.matterport.com/show/?m=%${id.charCodeAt(0).toString(16)}${id.slice(1)}`,
      `https://my.matterport.com/show/?m=other&m=${id}`,
    ]) assert.equal(availability.getAvailableModelTourUrl(slug, source), undefined, source);
    for (const source of [
      replacement,
      `https://my.matterport.com/show/?m=${id}x`,
      `https://momento360.com/e/u/${id}`,
      `https://other.example/show/?m=${id}`,
      "unrecognized-reference",
    ]) assert.equal(availability.getAvailableModelTourUrl(slug, source), source, source);
    const original = `https://my.matterport.com/show/?m=${id}`;
    assert.equal(availability.getAvailableModelTourUrl("different-model", original), original);
    assert.equal(availability.getAvailableModelTourUrl(slug, undefined), undefined);
  }
});

test("a reviewed new URL restores a Dutch tour without blocking the entire model or changing gallery, plans, specs or prices", () => {
  const normal = catalog();
  for (const slug of Object.keys(deadTours)) {
    const model = models.find((model) => model.slug === slug);
    // A synthetic fixture tests restoration plumbing, not model equivalence.
    const updated = { ...model, tourUrl: replacement };
    const restored = catalog([updated]).getHome(slug);
    assert.equal(restored.tourUrl, replacement);
    assert.deepEqual({ ...restored, id: normal.getHome(slug).id, tourUrl: undefined }, normal.getHome(slug));
    assert.equal(updated.tourUrl, replacement);
    assert.equal(model.tourUrl, `https://my.matterport.com/show/?m=${deadTours[slug]}`);
  }
});

const nil = () => null;
const Link = ({ href, children, ...props }) => createElement("a", { ...props, href }, children);
const icons = Object.fromEntries(["BedIcon", "BathIcon", "RulerIcon", "PinIcon", "PhoneIcon", "CheckIcon", "ArrowIcon"].map((name) => [name, nil]));
const Gallery = ({ images, name }) => createElement("div", null, images.map((src) => createElement("img", { key: src, src, alt: name })));
const { ModelVirtualTour } = load("src/components/model-virtual-tour.tsx", { react, "react/jsx-runtime": jsxRuntime });
const homes = catalog();
const sharedImports = {
  "react/jsx-runtime": jsxRuntime,
  "next/link": Link,
  "next/navigation": { notFound: () => { throw new Error("Unexpected 404"); } },
  "@/lib/metadata": { pageMetadata: (input) => input },
  "@/lib/homes": homes,
  "@/lib/home-types": types,
  "@/lib/media-policy": mediaPolicy,
  "@/lib/site": { site: { phoneDial: "18438494663", phoneDisplay: "(843) 849-HOME" } },
  "@/lib/jsonld": { JsonLd: nil, breadcrumbLd: nil, modelWebPageLd: nil, placedHomeLd: nil, placedHomeResidenceLd: nil },
  "@/components/icons": icons,
  "@/components/home-gallery": { HomeGallery: Gallery },
  "@/components/want-this-house-form": { WantThisHouseForm: nil },
  "@/components/historical-project-card": { HistoricalProjectCard: nil },
  "@/lib/historical-project-images": { insetProjectImageSizes: "", relatedProjectImageSizes: "" },
};
const { default: ModelPage } = load("src/app/homes/[slug]/page.tsx", {
  ...sharedImports,
  "@/lib/placed-homes": { getAllPlacedHomes: () => [] },
  "@/components/home-card": { HomeCard: nil },
  "@/components/model-virtual-tour": { ModelVirtualTour },
  "@/components/home-inquiry-dialog": { HomeInquiryDialog: nil },
  "@/components/width-selector": { WidthSelector: nil },
  "@/components/width-context": { WidthProvider: ({ children }) => children },
  "@/components/floor-plan-section": { FloorPlanSection: ({ floorPlans, name }) => Gallery({ images: floorPlans.map((plan) => plan.url), name }) },
  "@/components/model-package-journey": { ModelPackageJourney: nil },
});

test("real model-page rendering omits unavailable sections/controls but preserves authentic photos, existing floor plans and estimated prices", async () => {
  for (const slug of [...Object.keys(deadTours), "tradition-68", "eclipse"]) {
    const home = homes.getHome(slug);
    const html = renderToStaticMarkup(await ModelPage({ params: Promise.resolve({ slug }) }));
    const hasTour = Boolean(home.tourUrl);
    assert.equal(html.includes('id="tour"'), hasTour, slug);
    assert.equal(html.includes(`Start ${home.name} virtual tour`), hasTour, slug);
    assert.equal(html.includes("Open tour in a new tab"), hasTour, slug);
    assert.doesNotMatch(html, /<iframe/);
    if (hasTour) assert.ok(html.includes(mediaPolicy.trustedVirtualTourUrl(home.tourUrl).replaceAll("&", "&amp;")), slug);
    else assert.equal(html.includes(deadTours[slug]), false, slug);
    for (const source of [...home.imageUrls, ...(home.floorPlans ?? []).map((plan) => plan.url)]) {
      assert.ok(html.includes(source.replaceAll("&", "&amp;")), source);
    }
    assert.ok(html.includes(types.formatPrice(home.setupPrice)), slug);
    assert.ok(html.includes(types.formatPrice(home.price)), slug);
  }
});

test("real placed-home rendering advertises a 3D journey only for models with available projected tours", async () => {
  for (const slug of [...Object.keys(deadTours), "tradition-68"]) {
    const home = homes.getHome(slug);
    const placed = { ...json("data/placed-homes.json")[0], modelSlug: slug, modelName: home.name };
    const { default: PlacedPage } = load("src/app/recently-placed/[slug]/page.tsx", {
      ...sharedImports,
      "@/lib/asset": assets,
      "@/lib/placed-home-metadata": { placedHomeMetadata: nil },
      "@/lib/placed-homes": { getAllPlacedHomes: () => [placed], getPlacedHome: () => placed, relatedPlacedHomes: () => [] },
      "@/components/project-evidence": { ProjectEvidence: nil },
    });
    const html = renderToStaticMarkup(await PlacedPage({ params: Promise.resolve({ slug: placed.slug }) }));
    assert.ok(html.includes(`href="/homes/${slug}"`));
    assert.equal(html.includes(`href="/homes/${slug}#tour"`), Boolean(home.tourUrl), slug);
    assert.equal(html.includes("walk the whole thing in 3D"), Boolean(home.tourUrl), slug);
    assert.equal(html.includes("3D virtual tour"), Boolean(home.tourUrl), slug);
    if (deadTours[slug]) assert.equal(html.includes(deadTours[slug]), false, slug);
  }
});
