import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marked } from "marked";

const posts = JSON.parse(readFileSync("data/blog-posts.json", "utf8"));
const article = posts.find((post) => post.slug === "affordable-retirement-homes-grand-strand-no-hoa");
assert.ok(article);

test("retirement editorial changes keep the existing identity and publication fields", () => {
  assert.equal(article.date, "2026-07-16");
  assert.equal(article.readMinutes, 6);
  assert.deepEqual(article.tags, [
    "retirement", "no HOA", "Myrtle Beach", "single-level living",
    "land-home package", "snowbirds", "affordable homes",
  ]);
  assert.equal(article.title, "Retirement Homes Near Myrtle Beach: Compare Homes and Owned Lots");
  assert.match(article.description, /property-specific HOA restrictions/);
  assert.doesNotMatch(article.description, /without the fees|no surprises|guaranteed/i);
});

test("retirement guidance replaces categorical cost, HOA, title, and safety outcomes with specific checks", () => {
  const body = article.bodyMarkdown;
  assert.doesNotMatch(body, /whole category of expense disappears|keeping your monthly costs flat|monthly costs you can count on|no HOA, no lot rent, no surprises|simply how we do it here|no stairs to anything|designed to stand up to coastal wind/i);
  assert.match(body, /property-specific question, not a promise/);
  assert.match(body, /Owning your lot and avoiding HOA dues are not the same thing/);
  assert.match(body, /recorded deed restrictions, shared-road obligations/);
  assert.match(body, /does not make every monthly expense fixed or predictable/);
  assert.match(body, /Single-level rooms do not automatically mean a step-free home/);
  assert.match(body, /not automatically included/);
  assert.match(body, /Home Placer is a manufactured-home dealer, not a lender/);
  assert.match(body, /do not automatically establish real-property classification or loan approval/);
  assert.match(body, /not a guarantee of storm survival/);
  assert.match(body, /Follow local emergency and evacuation guidance/);
  assert.doesNotMatch(body, /\$\d|\d+(?:\.\d+)?%/);
});

test("retirement readers keep crawlable current inventory, planning, financing, and contact paths", () => {
  const html = marked.parse(article.bodyMarkdown, { async: false });
  for (const path of [
    "/homes", "/land-packages", "/guides/land-readiness-checklist",
    "/guides/home-land-scope", "/blog/manufactured-home-insurance-cost-grand-strand-sc",
    "/financing", "/buyer-resources", "/locations", "/contact",
  ]) assert.ok(html.includes(`href="${path}"`), path);
  assert.match(html, /\(843\) 849-HOME/);
  assert.doesNotMatch(html, /href="[^" ]*\?/);
});
