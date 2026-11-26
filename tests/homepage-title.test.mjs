import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { resolveTitle } = require("next/dist/lib/metadata/resolvers/resolve-title.js");
const read = (path) => readFileSync(path, "utf8");
const HOMEPAGE_TITLE = "Home Placer | Manufactured Homes on Land, Horry County SC";

function load(source, imports) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  }, compiled, compiled.exports);
  return compiled.exports;
}

const { site } = load(read("src/lib/site.ts"), {
  "../../data/business-identity.json": JSON.parse(read("data/business-identity.json")),
});
const { pageMetadata } = load(read("src/lib/metadata.ts"), { "./site": { site } });
const layout = load(read("src/app/layout.tsx"), {
  "next/script": { default: () => null },
  "next/font/google": {
    Geist: () => ({ variable: "--font-geist-sans" }),
    Fraunces: () => ({ variable: "--font-fraunces" }),
  },
  "./globals.css": {},
  "@/components/site-header": {},
  "@/components/site-footer": {},
  "@/components/analytics": {},
  "@/components/analytics-events": {},
  "@/components/contact-bar": {},
  "@/components/bottom-navigation": {},
  "@/lib/jsonld": {},
  "@/lib/site": { site },
  "react/jsx-runtime": require("react/jsx-runtime"),
});
const home = load(read("src/app/page.tsx"), {
  "@/lib/metadata": { pageMetadata },
  "next/link": { default: () => null },
  "@/components/sold-examples": {},
  "@/lib/site": { site },
  "@/lib/homes": {},
  "@/lib/gallery": {},
  "@/lib/curated-gallery-images": {},
  "@/components/curated-gallery-image": {},
  "@/lib/asset": {},
  "@/components/home-card": {},
  "@/components/testimonials": {},
  "@/components/contact-form": {},
  "@/components/forturro-land-search": {},
  "@/components/home-inquiry-dialog": {},
  "@/components/down-payment-assistance-dialog": {},
  "@/components/live-package-listings": {},
  "@/lib/forturro-package-feed": {},
  "@/lib/package-marketing": {},
  "@/components/icons": {},
  "react/jsx-runtime": require("react/jsx-runtime"),
});
const careers = load(read("src/app/careers/page.tsx"), {
  "@/lib/metadata": { pageMetadata },
  "@/components/career-application-form": {},
  "@/components/page-hero": {},
  "@/lib/jsonld": {},
  "@/lib/site": { site },
  "react/jsx-runtime": require("react/jsx-runtime"),
});

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? pages(path) : path.endsWith("page.tsx") ? [path] : [];
  });
}

test("homepage document title is the absolute phrase and other pages keep the site suffix", () => {
  const template = layout.metadata.title.template;
  assert.equal(template, `%s · ${site.name}`);
  assert.equal(site.name, "Home Placer");

  // Next writes <title> from the resolved absolute value, including when a parent template is present.
  const renderer = read("node_modules/next/dist/esm/lib/metadata/metadata.js");
  assert.match(renderer, /_jsx\("title", \{\s*children: metadata\.title\.absolute/);
  const resolved = resolveTitle(home.metadata.title, template);
  assert.equal(resolved.absolute, HOMEPAGE_TITLE);
  assert.equal(renderToStaticMarkup(React.createElement("title", null, resolved.absolute)), `<title>${HOMEPAGE_TITLE}</title>`);
  assert.equal(home.metadata.openGraph.title, HOMEPAGE_TITLE);
  assert.equal(home.metadata.twitter.title, HOMEPAGE_TITLE);
  assert.doesNotMatch(resolved.absolute, / · Home Placer$/);

  const other = resolveTitle(careers.metadata.title, template);
  assert.equal(careers.metadata.title, "Careers & Job Opportunities");
  assert.equal(other.absolute, "Careers & Job Opportunities · Home Placer");
  assert.equal(careers.metadata.openGraph.title, "Careers & Job Opportunities");
  assert.deepEqual(pages("src/app").filter((path) => read(path).includes("absolute:")), ["src/app/page.tsx"]);
});
