import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const models = readJson("data/models.json");
const packages = readJson("data/setup-pricing.json");
const homeOnly = readJson("data/home-pricing.json");
const originalQuotes = readJson("tests/fixtures/model-pricing-confirmed-20261002.json");
const modelSlugs = new Set(models.map((model) => model.slug));
const newlyQuotedSlugs = new Set(["stayin-alive", "caddie", "shout", "pegasus", "levi"]);
const retiredSlugs = new Set([
  "dutch-2963-ashley", "garner-3975", "greenwood", "lake-manor-2856h32p01", "shenandoah",
]);

test("every package estimate has a matching home-only estimate $65,000 lower", () => {
  assert.deepEqual(Object.keys(packages).sort(), Object.keys(homeOnly).sort());
  for (const [slug, packagePrice] of Object.entries(packages)) {
    assert.ok(modelSlugs.has(slug), `Unknown priced model: ${slug}`);
    assert.ok(Number.isSafeInteger(packagePrice) && packagePrice > 65000, slug);
    assert.ok(Number.isSafeInteger(homeOnly[slug]) && homeOnly[slug] > 0, slug);
    assert.equal(packagePrice - homeOnly[slug], 65000, slug);
  }
});

test("all 88 active models have confirmed package and home-only estimates", () => {
  assert.equal(Object.keys(packages).length, 88);
  assert.deepEqual(
    Object.keys(packages).sort(),
    models.filter((model) => !retiredSlugs.has(model.slug)).map((model) => model.slug).sort(),
  );
});

test("the original 83 package estimates are unchanged and their home-only estimates reflect the corrected deduction", () => {
  assert.equal(Object.keys(originalQuotes.packageEstimates).length, 83);
  assert.equal(Object.keys(originalQuotes.homeOnlyEstimates).length, 83);
  const originalEntries = (pricing) => Object.fromEntries(
    Object.entries(pricing).filter(([slug]) => !newlyQuotedSlugs.has(slug)),
  );
  assert.deepEqual(originalEntries(packages), originalQuotes.packageEstimates);
  assert.deepEqual(originalEntries(homeOnly), Object.fromEntries(
    Object.entries(originalQuotes.homeOnlyEstimates).map(([slug, price]) => [slug, price - 5000]),
  ));
});

test("the five newly confirmed quotes map to the existing models", () => {
  for (const [slug, name, packageEstimate, homeOnlyEstimate] of [
    ["stayin-alive", "Stayin' Alive", 229999, 164999],
    ["caddie", "Caddie", 249999, 184999],
    ["shout", "Shout", 229999, 164999],
    ["pegasus", "Pegasus", 229999, 164999],
    ["levi", "Levi", 189999, 124999],
  ]) {
    assert.equal(models.find((model) => model.slug === slug)?.name, name, slug);
    assert.equal(packages[slug], packageEstimate, slug);
    assert.equal(homeOnly[slug], homeOnlyEstimate, slug);
  }
});

test("the dealer's corrected quotes override earlier ambiguous dictation", () => {
  for (const [slug, expected] of Object.entries({
    lexi: 204999,
    atmos: 264999,
    sebastian: 274999,
    limelight: 239999,
    "summit-28603n": 254999,
    "ultra-flex-28-68": 239999,
    eclipse: 239999,
  })) {
    assert.equal(packages[slug], expected, slug);
  }
  assert.equal(packages.spirit, packages.lexi - 10000);
  assert.equal(packages["still-the-one"], packages.spirit - 10000);
  assert.equal(packages.yesterday, packages.spirit - 5000);
});

test("unquoted archived source models remain unpriced", () => {
  for (const slug of retiredSlugs) {
    assert.ok(modelSlugs.has(slug), slug);
    assert.equal(Object.hasOwn(packages, slug), false, slug);
    assert.equal(Object.hasOwn(homeOnly, slug), false, slug);
  }
});

test("buyer estimate guidance reflects the corrected deduction without promising parcel costs", () => {
  const guides = JSON.stringify(readJson("data/land-readiness-guides.json"));
  assert.ok(guides.includes("home-only estimate is $65,000 below"));
  assert.equal(guides.includes("home-only estimate is $60,000 below"), false);
  assert.ok(guides.includes("That difference is an estimating convention, not a separate quote"));
  assert.ok(guides.includes("quarter-acre lot"));
});

test("model display-name correction and retired source records preserve their slugs", () => {
  assert.equal(models.find((model) => model.slug === "ultra-flex-28-52")?.name, "Ultra Flex");
  for (const slug of [
    "dutch-2963-ashley",
    "garner-3975",
    "greenwood",
    "lake-manor-2856h32p01",
    "shenandoah",
  ]) {
    assert.ok(modelSlugs.has(slug), `Historical model record must remain: ${slug}`);
  }
});
