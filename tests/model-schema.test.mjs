import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the production builder with its actual client-safe model helpers.
// Unused site/location/JSX dependencies are isolated; nothing contacts a server.
function loadTs(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
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

const helpers = loadTs("src/lib/home-types.ts");
const { modelWebPageLd } = loadTs("src/lib/jsonld.tsx", {
  "@/lib/home-types": helpers,
  "@/lib/site": { site: { url: "https://hplacer.com" }, liveSocialUrls: [] },
  "@/lib/locations": { locations: [], counties: [] },
  "react/jsx-runtime": {},
});
const models = JSON.parse(readFileSync("data/models.json", "utf8"));

test("single-width Summit markup uses recorded floor area, not exterior footprint", () => {
  for (const [slug, area, incorrectArea] of [
    ["summit-28603n", 1580, 1680],
    ["summit-28564t", 1474, 1568],
  ]) {
    const model = models.find((entry) => entry.slug === slug);
    assert.equal(model.sqft, area, slug);
    const description = modelWebPageLd(model).mainEntity.description;
    assert.ok(description.includes(`(${area} square feet)`), slug);
    assert.equal(description.includes(`(${incorrectArea} square feet)`), false, slug);
  }
});

test("every model's schema mirrors the detail page's single or multi-width areas", () => {
  for (const model of models) {
    const schema = modelWebPageLd(model);
    assert.equal(schema["@type"], "WebPage");
    assert.equal(schema.mainEntity["@type"], "Thing");
    const multiWidth = helpers.isMultiWidth(model);
    for (const width of helpers.availableWidths(model)) {
      const area = multiWidth ? helpers.sqftForWidth(model, width) : model.sqft;
      assert.ok(
        schema.mainEntity.description.includes(`${width} × ${model.lengthFt} ft (${area} square feet)`),
        model.slug,
      );
    }
    assert.equal(schema.url, `https://hplacer.com/homes/${model.slug}`);
    assert.equal(Object.hasOwn(schema.mainEntity, "offers"), false);
    assert.equal(Object.hasOwn(schema.mainEntity, "aggregateRating"), false);
    assert.equal(Object.hasOwn(schema.mainEntity, "review"), false);
  }
});
