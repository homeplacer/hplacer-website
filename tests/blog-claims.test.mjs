import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { marked } from "marked";
import ts from "typescript";

const posts = JSON.parse(readFileSync("data/blog-posts.json", "utf8"));
const bySlug = (slug) => {
  const post = posts.find((entry) => entry.slug === slug);
  assert.ok(post, `Missing article: ${slug}`);
  return post;
};

function loadBlog() {
  const source = readFileSync("src/lib/blog.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require: (specifier) => {
      if (specifier === "marked") return { marked };
      if (specifier === "../../data/blog-posts.json") return { default: posts };
      if (specifier === "./blog-summary") return { getBlogTopic: () => "Buying & pricing" };
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return testModule.exports;
}

test("the blog loader preserves authored bodies, metadata, and historical prices without rewriting the catalog", () => {
  const before = JSON.stringify(posts);
  const blog = loadBlog();
  const loaded = blog.getScheduledPosts();
  assert.equal(loaded.length, posts.length);
  for (const post of loaded) {
    assert.equal(JSON.stringify(post), JSON.stringify(bySlug(post.slug)), post.slug);
  }
  assert.equal(JSON.stringify(posts), before, "sorting must not mutate imported article records");
  const history = loaded.find((post) => post.slug === "real-sc-land-home-package-case-study");
  assert.match(history.bodyMarkdown, /low-to-mid \$200s/);
  for (const price of ["$230,000", "$245,000", "$255,000", "$250,000", "$235,000"]) {
    assert.ok(history.bodyMarkdown.includes(price), `Historical sale missing: ${price}`);
  }
  assert.doesNotMatch(history.bodyMarkdown, /\$179,999/);
  assert.match(blog.renderMarkdown(history.bodyMarkdown), /low-to-mid \$200s/);
});

test("general price guidance links to current packages or estimates instead of an old fixed floor", () => {
  for (const post of posts) {
    assert.doesNotMatch(post.bodyMarkdown, /(?:from|in|with|the) (?:\*\*)?low \$200s/i, post.slug);
  }
  for (const slug of [
    "manufactured-home-land-package-cost-horry-county",
    "fha-va-conventional-financing-manufactured-homes-sc",
    "clayton-cavco-champion-brand-comparison",
    "manufactured-modular-mobile-home-difference",
    "buying-land-for-manufactured-home-grand-strand",
    "do-manufactured-homes-hold-value",
    "usda-zero-down-manufactured-home-rural-horry-county",
    "single-wide-vs-double-wide-manufactured-home",
    "manufactured-home-on-land-timeline-horry-county",
    "buying-manufactured-home-credit-not-perfect",
    "where-to-place-your-home-conway-loris-longs-aynor",
    "new-construction-homes-under-250k-myrtle-beach",
    "why-you-might-not-want-manufactured-home-sc",
    "manufactured-home-down-payment-requirements",
  ]) {
    assert.match(bySlug(slug).bodyMarkdown, /\]\(\/land-packages\)/, slug);
  }
});

test("USDA guidance checks the address and lender and does not incorrectly exclude every existing home", () => {
  const usda = bySlug("usda-zero-down-manufactured-home-rural-horry-county");
  assert.match(usda.bodyMarkdown, /https:\/\/eligibility\.sc\.egov\.usda\.gov\//);
  assert.match(usda.bodyMarkdown, /A map result is a starting check, not loan approval/);
  assert.match(usda.bodyMarkdown, /zero down does not mean no closing costs/);
  assert.match(usda.description, /subject to program and lender approval/);
  for (const slug of ["new-construction-homes-under-250k-myrtle-beach", "why-you-might-not-want-manufactured-home-sc", "new-vs-used-manufactured-home-on-land", "manufactured-homes-loris-longs-affordable-inland-sc"]) {
    assert.match(bySlug(slug).bodyMarkdown, /certain existing homes|certain existing manufactured homes/i, slug);
  }
  const used = bySlug("new-vs-used-manufactured-home-on-land").bodyMarkdown;
  assert.match(used, /moved from another homesite is not eligible/);
  assert.doesNotMatch(used, /usually \*\*cannot\*\* use a USDA loan/);
  for (const post of posts) {
    assert.doesNotMatch(post.bodyMarkdown, /(?:much|most|a lot) of (?:rural )?(?:Horry|the land).*qualifies|Most rural Loris and Longs parcels qualify/i, post.slug);
  }
});

test("title, wind, and closing guidance preserves qualifications instead of automatic outcomes", () => {
  for (const post of posts) {
    assert.doesNotMatch(post.bodyMarkdown, /stand up to (?:roughly )?100[ -]mph|withstand \*\*winds of about 100 mph|title flips from personal property|one package, one closing|qualifies as real property from day one/i, post.slug);
  }
  const wind = bySlug("manufactured-home-hurricane-wind-zone-2-sc").bodyMarkdown;
  assert.match(wind, /HUD's 100 mph figure is an engineering design basis, not a promise/);
  assert.match(wind, /follow local evacuation guidance/);
  for (const slug of ["questions-to-ask-before-buying-manufactured-home", "biggest-mistakes-buying-a-manufactured-home", "buying-a-manufactured-home-in-conway-sc"]) {
    assert.match(bySlug(slug).bodyMarkdown, /title-retirement/);
    assert.match(bySlug(slug).bodyMarkdown, /lender/);
  }
  for (const slug of ["owned-land-vs-leased-land-manufactured-home", "manufactured-home-real-property-vs-personal-property-sc"]) {
    assert.match(bySlug(slug).bodyMarkdown, /FHA Title I program/);
    assert.match(bySlug(slug).bodyMarkdown, /personal-property.*leased|leased.*personal-property/);
  }
  assert.match(bySlug("manufactured-home-land-package-cost-horry-county").bodyMarkdown, /lender and closing attorney must confirm/);
  const warranty = bySlug("new-home-warranty-coverage-explained").bodyMarkdown;
  assert.match(warranty, /one-year builder warranty for defects/);
  assert.match(warranty, /two years of mechanical coverage/);
  assert.match(warranty, /ten years of structural coverage/);
  assert.match(warranty, /Coverage, exclusions, and claim procedures follow your written warranties/);
});
