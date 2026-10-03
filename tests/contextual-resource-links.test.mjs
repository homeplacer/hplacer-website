import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(path, "utf8");
const icon = () => React.createElement("svg", { "aria-hidden": true });

function renderPage(name) {
  const source = read(`src/app/${name}/page.tsx`);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const imports = {
    "@/lib/metadata": { pageMetadata: (metadata) => metadata },
    "next/link": { default: (props) => React.createElement("a", props) },
    "@/components/page-hero": {
      PageHero: ({ title, children }) => React.createElement("header", null,
        React.createElement("h1", null, title), React.createElement("p", null, children)),
    },
    "@/components/icons": { CheckIcon: icon, PhoneIcon: icon, ArrowIcon: icon },
    "@/components/financing-form": { FinancingForm: () => React.createElement("form", { "data-existing-financing-form": true }) },
    "@/lib/site": { site: {
      phoneDial: "+18438494663", phoneDisplay: "(843) 849-HOME",
      warrantyPhoneDial: "+18434849844", warrantyPhoneDisplay: "(843) 484-9844",
    } },
    "@/lib/resource-navigation": { buyerLearningLinks: [] },
  };
  const testModule = { exports: {} };
  runInNewContext(outputText, {
    module: testModule, exports: testModule.exports,
    require: (specifier) => {
      if (specifier in imports) return imports[specifier];
      if (specifier === "react" || specifier === "react/jsx-runtime") return require(specifier);
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return { source, html: renderToStaticMarkup(React.createElement(testModule.exports.default)) };
}

const pages = Object.fromEntries(
  ["financing", "warranty", "buyer-resources", "process"].map((name) => [name, renderPage(name)]),
);
const articlePaths = [
  "/blog/manufactured-home-down-payment-requirements",
  "/blog/manufactured-home-insurance-cost-grand-strand-sc",
  "/blog/new-home-warranty-coverage-explained",
  "/blog/affordable-retirement-homes-grand-strand-no-hoa",
];
const guidePaths = [
  "/guides/home-land-scope", "/guides/horry-county-lot-review",
  "/guides/horry-towns-jurisdiction", "/guides/project-sequence",
  "/guides/water-septic-sewer-questions",
];

test("buyer articles have server-rendered links at the matching decision point", () => {
  for (const path of articlePaths.slice(0, 2)) assert.ok(pages.financing.html.includes(`href="${path}"`));
  assert.ok(pages.financing.html.includes('href="/glossary"'));
  assert.ok(pages.warranty.html.includes(`href="${articlePaths[2]}"`));
  assert.ok(pages["buyer-resources"].html.includes(`href="${articlePaths[3]}"`));
  const posts = JSON.parse(read("data/blog-posts.json"));
  for (const path of articlePaths) assert.ok(posts.some((post) => `/blog/${post.slug}` === path), path);
  for (const { source, html } of Object.values(pages)) {
    assert.doesNotMatch(source, /["']use client["']/);
    assert.doesNotMatch(html, /href="[^" ]*\?(?:model|brand|wall)=/);
  }
});

test("planning guides stay beside their relevant process step, not in a sitewide link list", () => {
  const html = pages.process.html;
  const scope = html.match(/<li class="flex gap-5[^>]*>.*?<\/li><\/ul><\/div><\/li>/)?.[0];
  assert.ok(scope?.includes('href="/guides/home-land-scope"'));
  const land = html.slice(html.indexOf("Pick your land"), html.indexOf("Review financing with a lender"));
  for (const path of guidePaths.slice(1, 3)) assert.ok(land.includes(`href="${path}"`), path);
  const setup = html.slice(html.indexOf("We handle the setup"), html.indexOf("Move in"));
  for (const path of guidePaths.slice(3)) assert.ok(setup.includes(`href="${path}"`), path);
  const guides = JSON.parse(read("data/land-readiness-guides.json")).guides;
  for (const path of guidePaths) {
    assert.ok(guides.some((guide) => `/guides/${guide.slug}` === path), path);
    assert.equal(html.split(`href="${path}"`).length - 1, 1, path);
  }
});

test("secondary reading preserves qualified claims and the primary contact and service actions", () => {
  assert.match(pages.financing.html, /Your lender and insurance agent must provide the figures/);
  assert.match(pages.financing.html, /Home Placer is not a lender/);
  assert.match(pages.financing.html, /data-existing-financing-form="true"/);
  assert.match(pages.financing.html, /href="tel:\+18438494663"/);
  assert.match(pages["buyer-resources"].html, /Confirm HOA or deed restrictions/);
  assert.match(pages["buyer-resources"].html, /href="\/contact"/);
  assert.match(pages["buyer-resources"].html, /href="https:\/\/www\.rd\.usda\.gov\/programs-services\/single-family-housing-programs\/single-family-housing-guaranteed-loan-program"/);
  assert.match(pages.warranty.html, /one-year builder warranty for defects/);
  assert.match(pages.warranty.html, /two years of mechanical coverage and ten years of structural coverage through the 2–10 company/);
  assert.match(pages.warranty.html, /Your written warranties determine the applicable coverage/);
  assert.match(pages.warranty.html, /href="\/warranty-request"/);
  assert.match(pages.warranty.html, /href="tel:\+18434849844"/);
  assert.match(pages.process.html, /href="\/contact"/);
});
