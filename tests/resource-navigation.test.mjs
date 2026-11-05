import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/lib/resource-navigation.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const navigation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("compact footer keeps the existing resource paths and adds the blog", () => {
  assert.deepEqual(navigation.footerResourceHrefs, [
    "/packages", "/guides", "/stories", "/buyer-resources", "/gallery",
    "/process", "/warranty", "/faq", "/blog",
  ]);
  assert.equal(new Set(navigation.footerResourceHrefs).size, navigation.footerResourceHrefs.length);
  const footer = readFileSync("src/components/site-footer.tsx", "utf8");
  assert.match(footer, /resourceLinks\.filter/);
  assert.doesNotMatch(footer, /resourceLinks\.slice/);
  assert.match(footer, /href="\/careers"/);
  assert.match(footer, /min-h-11/);
});

test("buyer resource hub restores real paths into definitions and comparisons", () => {
  const paths = navigation.buyerLearningLinks.map((link) => link.href);
  assert.deepEqual(paths, [
    "/blog", "/glossary", "/manufactured-vs-site-built",
    "/modular-vs-manufactured-homes", "/mobile-home-vs-manufactured-home",
  ]);
  for (const path of [...navigation.footerResourceHrefs, ...paths, "/careers"]) {
    assert.ok(existsSync(`src/app${path}/page.tsx`), path);
  }
  const page = readFileSync("src/app/buyer-resources/page.tsx", "utf8");
  assert.match(page, /buyerLearningLinks\.map/);
  assert.match(page, /href=\{resource\.href\}/);
  assert.doesNotMatch(page, /["']use client["']/);
});
