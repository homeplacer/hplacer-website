import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const models = readJson("data/models.json");
const packages = readJson("data/setup-pricing.json");
const homeOnly = readJson("data/home-pricing.json");
const modelSlugs = new Set(models.map((model) => model.slug));

test("every package estimate has a matching home-only estimate $60,000 lower", () => {
  assert.deepEqual(Object.keys(packages).sort(), Object.keys(homeOnly).sort());
  for (const [slug, packagePrice] of Object.entries(packages)) {
    assert.ok(modelSlugs.has(slug), `Unknown priced model: ${slug}`);
    assert.ok(Number.isSafeInteger(packagePrice) && packagePrice > 60000, slug);
    assert.ok(Number.isSafeInteger(homeOnly[slug]) && homeOnly[slug] > 0, slug);
    assert.equal(packagePrice - homeOnly[slug], 60000, slug);
  }
});

test("the confirmed pricing batch contains 83 package estimates", () => {
  assert.equal(Object.keys(packages).length, 83);
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

test("models without a recorded quote keep their inquiry fallback", () => {
  for (const slug of ["stayin-alive", "shout", "caddie", "pegasus", "levi"]) {
    assert.ok(modelSlugs.has(slug), slug);
    assert.equal(Object.hasOwn(packages, slug), false, slug);
    assert.equal(Object.hasOwn(homeOnly, slug), false, slug);
  }
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
