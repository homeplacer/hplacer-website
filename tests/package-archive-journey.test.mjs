import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const models = JSON.parse(read("data/models.json"));
const records = JSON.parse(read("data/land-home-packages.json")).packages;
const load = (path, imports = {}) => {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const compiled = { exports: {} };
  const require = (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  };
  new Function("require", "module", "exports", outputText)(require, compiled, compiled.exports);
  return compiled.exports;
};
const policy = load("src/lib/package-policy.ts");
const { contactContextHref } = load("src/lib/contact-context.ts");
const now = Date.parse("2026-10-03T18:00:00Z");
const modelSlugs = new Set(models.map((model) => model.slug));
const published = records.filter((record) =>
  policy.packageErrors(record, modelSlugs, now).length === 0 && policy.packageIsPublic(record, now),
);
const anchor = ({ href, children, ...props }) => createElement("a", { href, ...props }, children);
const { default: Page, metadata } = load("src/app/packages/page.tsx", {
  "react/jsx-runtime": jsxRuntime,
  "next/link": anchor,
  "@/components/page-hero": {
    PageHero: ({ title, children }) => createElement("section", null, createElement("h1", null, title), children),
  },
  "@/lib/metadata": { pageMetadata: (input) => input },
  "@/lib/packages": { getPackages: () => published, packageState: (record) => policy.packageState(record, now) },
  "@/lib/jsonld": { JsonLd: () => null },
  "@/lib/homes": { getHome: (slug) => models.find((model) => model.slug === slug) },
  "@/components/home-inquiry-dialog": {
    HomeInquiryDialog: ({ homeName, label }) => createElement("a", { href: contactContextHref(homeName) }, label),
  },
});
const htmlFor = async (filters = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(filters) }));
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("'", "&#x27;");

test("all eight model filters render their existing records and an appropriate next step without JavaScript", async () => {
  const slugs = [...new Set(published.map((record) => record.modelSlug))];
  assert.equal(slugs.length, 8);
  assert.equal(published.length, 10);
  for (const slug of slugs) {
    const html = await htmlFor({ model: slug });
    const model = models.find((item) => item.slug === slug);
    const matches = published.filter((record) => record.modelSlug === slug);
    assert.equal((html.match(/<article /g) ?? []).length, matches.length, slug);
    assert.ok(html.includes(`${escapeHtml(model.name)} package examples`), slug);
    assert.ok(html.includes(`href="/homes/${slug}"`), slug);
    assert.ok(html.includes(`href="${escapeHtml(contactContextHref(model.name))}"`), slug);
    assert.match(html, /href="\/land-packages"/);
    assert.match(html, /Sold examples show past projects, not homes available to buy/);
    for (const record of matches) {
      assert.ok(html.includes(`href="/packages/${record.id}"`), record.id);
      assert.ok(html.includes(record.market), record.id);
      assert.ok(html.includes(`${record.lotAcres} acres`), record.id);
      assert.ok(html.includes(record.included[0]), record.id);
      assert.ok(html.includes(record.excludedOrVariable[0]), record.id);
    }
  }
});

test("the unfiltered archive keeps all ten records and makes no claim that live inventory is empty", async () => {
  const html = await htmlFor();
  assert.equal((html.match(/<article /g) ?? []).length, 10);
  assert.match(html, /Current properties are listed separately/);
  assert.doesNotMatch(html, /No currently available packages have been verified/);
  assert.equal(metadata.alternates.canonical, "/packages");
  assert.doesNotMatch(metadata.description, /verified/i);
  assert.match(metadata.description, /recorded land-home project examples/);
});

test("town and status filters preserve model context; empty combinations have a clear recovery", async () => {
  const existing = await htmlFor({ model: "stayin-alive", market: "Conway, SC", status: "sold" });
  assert.equal((existing.match(/<article /g) ?? []).length, published.filter((record) => record.modelSlug === "stayin-alive" && record.market === "Conway, SC").length);
  assert.match(existing, /type="hidden" name="model" value="stayin-alive"/);
  const empty = await htmlFor({ model: "birdie", market: "Conway, SC" });
  assert.equal((empty.match(/<article /g) ?? []).length, 0);
  assert.match(empty, /No published project records match these filters/);
  assert.match(empty, /This does not determine whether a model or a new package is available/);
  assert.match(empty, /Browse all recorded projects/);
  assert.match(empty, /href="\/land-packages"/);
});

test("the page uses the existing inquiry dialog and limits added facts to published fields", () => {
  const page = read("src/app/packages/page.tsx");
  assert.match(page, /HomeInquiryDialog/);
  assert.match(page, /homeName=\{selectedHome\?\.name \?\? "a land-home package"\}/);
  assert.match(page, /p\.included\.map/);
  assert.match(page, /p\.excludedOrVariable\.map/);
  assert.doesNotMatch(page, /["']use client["']|sourceRecord|lastVerifiedBy|mediaPermission|packagePrice/);
});
