import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const { outputText } = ts.transpileModule(read("src/lib/package-marketing.ts"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { currentPackageFloorLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("the marketing floor follows valid live list prices without mutating inventory", () => {
  const prices = Object.freeze([245000, 177500, 230000]);
  assert.equal(currentPackageFloorLabel(prices), "$177,500");
  assert.equal(currentPackageFloorLabel([210000]), "$210,000");
  assert.equal(currentPackageFloorLabel([0, -1, NaN, Infinity, 205000]), "$205,000");
  assert.deepEqual(prices, [245000, 177500, 230000]);
});

test("empty or unusable live inventory never invents a fixed starting price", () => {
  assert.equal(currentPackageFloorLabel([]), null);
  assert.equal(currentPackageFloorLabel([0, -1, NaN, Infinity]), null);
  const page = read("src/app/page.tsx");
  assert.match(page, /livePackages\.map\(\(listing\) => listing\.listPrice\)/);
  assert.match(page, /Ask our local team about current land-home package availability and pricing/);
  assert.match(page, /packageFloorLabel \?\? "Ask about availability"/);
  assert.doesNotMatch(page, /site\.priceFrom/);
  assert.doesNotMatch(read("src/lib/site.ts"), /priceFrom:/);
});

test("shared and public package copy does not advertise the old floor or universal HOA and closing terms", () => {
  for (const path of [
    "src/lib/site.ts", "src/lib/glossary.ts", "src/app/page.tsx",
    "src/app/about/page.tsx", "src/app/homes/page.tsx",
    "src/app/homes/[slug]/page.tsx", "src/app/opengraph-image.tsx",
    "src/app/recently-placed/page.tsx", "src/app/recently-placed/[slug]/page.tsx",
  ]) {
    assert.doesNotMatch(read(path), /179,999|179999|\bno HOA\b|\$0 HOA|one price|one closing|land with every home/i, path);
  }
  assert.match(read("src/lib/site.ts"), /Confirm HOA fees, deed restrictions, and placement requirements/);
  assert.match(read("src/app/about/page.tsx"), /href="\/land-packages"/);
  assert.match(read("src/app/recently-placed/page.tsx"), /size varies by property/);
});

test("copy keeps owner-confirmed warranties and a written project scope instead of changing business terms", () => {
  const site = read("src/lib/site.ts");
  assert.match(site, /one-year builder warranty for defects/);
  assert.match(site, /two years of mechanical coverage and ten years of structural coverage/);
  assert.match(site, /Coverage, exclusions, and claim procedures follow your written warranties/);
  assert.match(site, /Licensed SC dealer/);
  assert.match(read("src/app/about/page.tsx"), /included work, allowances, exclusions, and closing arrangements/);
  assert.match(read("src/app/homes/page.tsx"), /quarter-acre lot/);
});
