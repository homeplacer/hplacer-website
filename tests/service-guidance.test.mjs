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
const servicePageSource = read("src/app/service-request/page.tsx");
const formSource = read("src/components/service-request-form.tsx");
const site = {
  phoneDial: "+18438494663",
  phoneDisplay: "(843) 849-HOME",
  email: "Carolina@hplacer.com",
  warrantyPhoneDial: "+18434849844",
  warrantyPhoneDisplay: "(843) 484-9844",
};

function loadComponent(source, imports) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require: (specifier) => {
      if (specifier in imports) return imports[specifier];
      if (specifier === "react" || specifier === "react/jsx-runtime") return require(specifier);
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return testModule.exports;
}

const icon = () => React.createElement("svg", { "aria-hidden": true });
const safety = loadComponent(read("src/components/public-lead-form-safety.tsx"), {
  "@/lib/site": { site },
});
const { ServiceRequestForm } = loadComponent(formSource, {
  "@/components/public-lead-form-safety": safety,
  "@/lib/phone-pattern": loadComponent(read("src/lib/phone-pattern.ts"), {}),
  "@/components/icons": { CheckIcon: icon, ArrowIcon: icon },
  "@/lib/site": { site },
  "@/components/honeypot": { Honeypot: () => null },
  "@/lib/lead": { submitLead: () => { throw new Error("No test lead may be submitted"); } },
});
const page = loadComponent(servicePageSource, {
  "@/lib/metadata": { pageMetadata: (metadata) => metadata },
  "next/link": { default: (props) => React.createElement("a", props) },
  "@/components/icons": { PhoneIcon: icon, ArrowIcon: icon },
  "@/lib/site": { site },
  "@/components/service-request-form": { ServiceRequestForm },
});
const html = renderToStaticMarkup(React.createElement(page.default));

test("homeowners see distinct general-service and warranty/photo routes", () => {
  assert.match(html, /<h1[^>]*>Request service<\/h1>/);
  assert.match(html, /href="\/warranty-request"/);
  assert.match(html, /Warranty request with photos/);
  assert.match(html, /href="\/warranty"/);
  assert.match(html, /href="tel:\+18434849844"/);
  assert.equal(page.metadata.alternates.canonical, "/service-request");
  for (const heading of ["What to include", "Identify the home", "Describe what changed", "Note access and availability"]) {
    assert.ok(html.includes(heading), heading);
  }
});

test("service guidance preserves confirmed warranties without promising coverage or a schedule", () => {
  assert.match(html, /one-year builder warranty for defects/);
  assert.match(html, /separate 2–10 Home Buyers Warranty/);
  assert.match(html, /two years of mechanical coverage/);
  assert.match(html, /ten years of structural coverage through the 2–10 company/);
  assert.match(html, /Coverage, exclusions, and claim procedures follow your written warranties/);
  assert.match(html, /Submitting the form does not confirm an appointment, repair, or coverage/);
  assert.match(html, /Wait for a confirmed appointment/);
  for (const path of ["src/app/service-request/page.tsx", "src/app/warranty/page.tsx", "src/lib/site.ts", "src/app/about/page.tsx", "src/app/team/page.tsx", "src/app/process/page.tsx", "src/app/page.tsx"]) {
    assert.doesNotMatch(read(path), /30[ -]?day|thirty[ -]?day/i, path);
  }
});

test("the existing service form keeps email optional and the current lead payload", () => {
  const emailInput = html.match(/<input\b[^>]*\bid="sr-email"[^>]*>/)?.[0];
  assert.ok(emailInput);
  assert.match(emailInput, /name="email"/);
  assert.match(emailInput, /type="email"/);
  assert.doesNotMatch(emailInput, /\brequired\b/);
  assert.match(html, /Email is optional/);
  for (const id of ["sr-name", "sr-phone", "sr-message"]) {
    const field = html.match(new RegExp(`<(?:input|textarea)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(field, id);
    assert.match(field, /\brequired\b/, id);
  }
  assert.match(formSource, /Object\.fromEntries\(new FormData\(form\)\.entries\(\)\)/);
  assert.match(formSource, /submitLead\("service", data\)/);
  assert.match(html, /data-form-type="service"/);
});

test("buyer articles keep the confirmed warranty coverage without an unconfirmed thirty-day visit", () => {
  const posts = JSON.parse(read("data/blog-posts.json"));
  assert.ok(Array.isArray(posts));
  for (const post of posts) {
    assert.doesNotMatch(post.bodyMarkdown ?? "", /30[ -]?day|thirty[ -]?day/i, post.slug);
  }
  const warrantyArticle = posts.find((post) => post.slug === "new-home-warranty-coverage-explained");
  assert.ok(warrantyArticle);
  assert.match(warrantyArticle.bodyMarkdown, /one-year builder warranty for defects/);
  assert.match(warrantyArticle.bodyMarkdown, /two years of mechanical coverage/);
  assert.match(warrantyArticle.bodyMarkdown, /ten years of structural coverage/);
  assert.match(warrantyArticle.bodyMarkdown, /Coverage, exclusions, and claim procedures follow your written warranties/);
  assert.match(warrantyArticle.bodyMarkdown, /\[warranty request form\]\(\/warranty-request\)/);
});
