import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const load = async (path) => {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
};
const { modelPackageHref } = await load("src/lib/model-package-links.ts");
const policy = await load("src/lib/package-policy.ts");
const models = JSON.parse(readFileSync("data/models.json", "utf8"));
const modelSlugs = new Set(models.map((model) => model.slug));
const now = Date.parse("2026-10-03T12:00:00Z");
const records = JSON.parse(readFileSync("data/land-home-packages.json", "utf8")).packages;
const published = records.filter((record) => policy.packageErrors(record, modelSlugs, now).length === 0 && policy.packageIsPublic(record, now));

test("model filters are linked only when a published package record exists", () => {
  assert.equal(modelPackageHref("beacon", published), null);
  assert.equal(modelPackageHref("ultra-flex-28-52", published), "/packages?model=ultra-flex-28-52");
  assert.equal(modelPackageHref("stayin-alive", published), "/packages?model=stayin-alive");
  assert.equal(modelPackageHref("unknown", published), null);
  assert.equal(modelPackageHref("stayin-alive", []), null);
  for (const model of models) {
    const href = modelPackageHref(model.slug, published);
    assert.equal(href !== null, published.some((record) => record.modelSlug === model.slug), model.slug);
  }
});

test("every generated model filter has real records and duplicate sales need only one link", () => {
  const hrefs = models.map((model) => modelPackageHref(model.slug, published)).filter(Boolean);
  assert.equal(hrefs.length, new Set(published.map((record) => record.modelSlug)).size);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) {
    const slug = new URL(href, "https://example.test").searchParams.get("model");
    assert.ok(published.some((record) => record.modelSlug === slug), href);
  }
});

test("empty model archive paths retain contextual inquiry and canonical current packages", () => {
  const component = readFileSync("src/components/model-package-journey.tsx", "utf8");
  assert.match(component, /modelPackageHref\(modelSlug, getPackages\(\)\)/);
  assert.match(component, /HomeInquiryDialog homeName=\{homeName\}/);
  assert.match(component, /href="\/land-packages"/);
  assert.doesNotMatch(component, /["']use client["']/);
  const page = readFileSync("src/app/homes/[slug]/page.tsx", "utf8");
  assert.match(page, /ModelPackageJourney homeName=\{home\.name\} modelSlug=\{home\.slug\}/);
  assert.doesNotMatch(page, /href=\{`\/packages\?model=\$\{home\.slug\}`\}/);
});
