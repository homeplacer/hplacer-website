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
const unavailable = {
  glimpse: "https://api.claytonhomes.com/images/mfg/int/b57253ac-2692-4d47-9d46-202c1185b5c5.jpg?width=992",
  "rhythm-nation": "https://api.claytonhomes.com/images/mfg/int/4fc082a6-a88a-4a54-89e4-0cfb1a3cdaa6.jpg?width=992",
};

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const testModule = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    testModule,
    testModule.exports,
  );
  return testModule.exports;
}

function catalog(records = models) {
  return load("src/lib/homes.ts", {
    "./home-types": load("src/lib/home-types.ts"),
    "./asset": load("src/lib/asset.ts"),
    "./model-tour-availability": load("src/lib/model-tour-availability.ts"),
    "../../data/models.json": records,
    "../../data/setup-pricing.json": json("data/setup-pricing.json"),
    "../../data/home-pricing.json": json("data/home-pricing.json"),
  });
}

const galleryImages = load("src/lib/model-gallery-images.ts", {
  "./model-gallery-assets.json": json("src/lib/model-gallery-assets.json"),
});
const { FallbackImage } = load("src/components/fallback-image.tsx", {
  react,
  "react/jsx-runtime": jsxRuntime,
});
const { HomeGallery } = load("src/components/home-gallery.tsx", {
  react,
  "react/jsx-runtime": jsxRuntime,
  "@/components/icons": { HomeMark: () => null },
  "@/components/fallback-image": { FallbackImage },
  "@/components/home-gallery-lightbox": { HomeGalleryLightbox: () => null },
  "@/lib/model-gallery-images": galleryImages,
});

test("only the two confirmed dead images are withheld, preserving authentic photo order and source records", () => {
  const homes = catalog();
  for (const model of models) {
    const original = structuredClone(model);
    const home = homes.getHome(model.slug);
    assert.ok(home, model.slug);
    assert.deepEqual(
      home.imageUrls,
      model.imageUrls.filter((source) => source !== unavailable[model.slug]),
      model.slug,
    );
    assert.equal(home.imageUrls[0], model.imageUrls[0], model.slug);
    assert.equal(
      home.tourUrl,
      ["dutch-elite-1676-01", "dutch-elite-1676-07"].includes(model.slug)
        ? undefined : model.tourUrl,
      model.slug,
    );
    assert.deepEqual(home.floorPlans, model.floorPlans ?? [], model.slug);
    assert.deepEqual(model, original, "customer projection must not mutate raw records");
  }
  assert.equal(homes.getHome("glimpse").imageUrls.length, 13);
  assert.equal(homes.getHome("rhythm-nation").imageUrls.length, 12);
});

test("quarantine matches source identity despite width/query/hash changes, not other hosts, paths, models, or local files", () => {
  for (const [slug, dead] of Object.entries(unavailable)) {
    const model = models.find((record) => record.slug === slug);
    const clean = dead.split("?")[0];
    const retained = [
      model.imageUrls[0],
      clean.replace("api.claytonhomes.com", "another.example"),
      clean.replace("/int/", "/ext/"),
      `/models/${slug}/01.jpg`,
      "unrecognized-reference",
    ];
    const input = [...retained, dead, clean, `${clean}?width=640#photo`, `${clean}?width=160&quality=80`];
    const fixture = { ...model, imageUrls: input };
    const other = { ...model, slug: "different-model", imageUrls: input };
    const homes = catalog([fixture, other]);
    assert.deepEqual(homes.getHome(slug).imageUrls, retained);
    assert.deepEqual(homes.getHome("different-model").imageUrls, input);
    assert.deepEqual(fixture.imageUrls, input);
  }
});

test("server-readable galleries and no-JavaScript photo access never advertise quarantined images", () => {
  const homes = catalog();
  for (const [slug, dead] of Object.entries(unavailable)) {
    const home = homes.getHome(slug);
    const html = renderToStaticMarkup(createElement(HomeGallery, {
      images: home.imageUrls,
      name: home.name,
      brand: home.brand,
    }));
    assert.equal(html.includes(dead.split("?")[0]), false, slug);
    assert.ok(html.includes(`See all ${home.imageUrls.length} photos`), slug);
    assert.match(html, /<noscript>/);
    assert.match(html, /loading="eager" fetchPriority="high"/);
    for (const source of home.imageUrls) {
      assert.ok(html.includes(`href="${source.replaceAll("&", "&amp;")}"`), source);
    }
  }
});
