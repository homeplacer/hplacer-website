import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const routeSource = read("src/app/llms.txt/route.ts");
const auditDay = "2026-10-03";

class AuditDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [`${auditDay}T12:00:00Z`]));
  }
}

function loadTs(path, dependencies = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports,
    Response,
    URL,
    Date: AuditDate,
    console,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

function manifestFixture({ extraPosts = [], reviews } = {}) {
  const identity = json("data/business-identity.json");
  const { site } = loadTs("src/lib/site.ts", {
    "../../data/business-identity.json": { default: identity },
  });
  if (reviews) Object.assign(site.gbp, reviews);
  const homes = loadTs("src/lib/homes.ts", {
    "./home-types": loadTs("src/lib/home-types.ts"),
    "./asset": loadTs("src/lib/asset.ts"),
    "./model-tour-availability": loadTs("src/lib/model-tour-availability.ts"),
    "../../data/models.json": { default: json("data/models.json") },
    "../../data/setup-pricing.json": { default: json("data/setup-pricing.json") },
    "../../data/home-pricing.json": { default: json("data/home-pricing.json") },
  });
  const posts = [...json("data/blog-posts.json"), ...extraPosts];
  const blog = loadTs("src/lib/blog.ts", {
    marked: {},
    "../../data/blog-posts.json": { default: posts },
    "./blog-summary": {},
  });
  const locations = loadTs("src/lib/locations.ts");
  const route = loadTs("src/app/llms.txt/route.ts", {
    "@/lib/site": { site },
    "@/lib/homes": homes,
    "@/lib/blog": blog,
    "@/lib/locations": locations,
  });
  return { route, site, homes, blog, locations };
}

test("the existing static GET stays plain text without a new runtime, cache, or request dependency", async () => {
  const { route } = manifestFixture();
  assert.deepEqual(Object.keys(route).sort(), ["GET", "dynamic"]);
  assert.equal(route.dynamic, "force-static");
  assert.equal(route.GET.length, 0);
  const response = route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), null);
  assert.match(await response.text(), /^# Home Placer/);
  assert.doesNotMatch(routeSource, /\bfetch\(|process\.env|next\/headers|revalidate|fetchCache|export (?:const|function) (?:POST|PUT|DELETE)/);
});

test("manifest model counts, featured models, and town identities come from the current catalog", async () => {
  const { route, site, homes, locations } = manifestFixture();
  const body = await route.GET().text();
  const currentHomes = homes.getAllHomes();
  assert.match(body, new RegExp(`## Inventory \\(${currentHomes.length} models\\)`));
  const byBrand = {};
  for (const home of currentHomes) byBrand[home.brand] = (byBrand[home.brand] || 0) + 1;
  for (const [brand, count] of Object.entries(byBrand)) {
    assert.ok(body.includes(`- ${brand}: ${count} models`));
  }
  const featured = body.split("## Featured models\n")[1].split("\n\n## Inventory")[0];
  const expected = homes.bestSellerHomes().slice(0, 8);
  assert.equal((featured.match(/^- \[/gm) || []).length, expected.length);
  for (const home of expected) {
    assert.ok(featured.includes(`(${site.url}/homes/${home.slug})`), home.slug);
    assert.ok(featured.includes(`${home.beds} bed / ${home.baths} bath, ${home.sqft.toLocaleString()} sq ft (${home.widthFt}×${home.lengthFt})`), home.slug);
  }
  for (const location of locations.locations) {
    assert.ok(body.includes(`${location.name}, ${locations.counties[location.countyKey].stateAbbr}`));
  }
});

test("recent article links retain the actual loader's date gating and six-article limit", async () => {
  const fixture = manifestFixture({ extraPosts: [
    { slug: "future-manifest-test", title: "Unpublished future article", date: "2099-12-31" },
    { slug: "today-manifest-test", title: "Today's published article", date: auditDay },
  ] });
  const body = await fixture.route.GET().text();
  const recent = body.split("## Recent articles\n")[1];
  const published = fixture.blog.getAllPosts().slice(0, 6);
  assert.equal((recent.match(/^- \[/gm) || []).length, published.length);
  for (const post of published) assert.ok(recent.includes(`[${post.title}](${fixture.site.url}/blog/${post.slug})`));
  assert.ok(recent.includes("today-manifest-test"));
  assert.equal(body.includes("future-manifest-test"), false);
});

test("current prices and reviews are linked, not frozen as offers or ratings", async () => {
  const { route, site } = manifestFixture({ reviews: { rating: 1.2, reviewCount: 123456 } });
  const body = await route.GET().text();
  assert.ok(body.includes(`[current land-home listings](${site.url}/land-packages)`));
  assert.ok(body.includes(`[home models](${site.url}/homes)`));
  assert.ok(body.includes(`[View the current profile and reviews](${site.gbp.url})`));
  assert.doesNotMatch(body, /179,999|179999|123456|1\.2★|\d+ reviews|one package, one price|one closing|\bNo HOA\b|Skyline Champion Corporation|largest builder/i);
  assert.match(body, /quarter-acre lot/);
  assert.match(body, /lot size, location, site work, utility costs, options, and the written project scope/);
  assert.match(body, /Call, text, or email/);
});

test("parcel and lending qualifications preserve the confirmed warranty and correct all four county zones", async () => {
  const body = await manifestFixture().route.GET().text();
  assert.match(body, /Horry and Georgetown counties in SC and Brunswick and Columbus counties in NC are all in \*\*HUD Wind Zone II\*\*/);
  assert.match(body, /data-plate ratings/);
  assert.match(body, /not a storm-safety guarantee/);
  assert.doesNotMatch(body, /Wind Zone I\b|most of rural|qualifies for USDA|typically a few months|manage the process end to end/i);
  for (const term of ["HOA status", "deed restrictions", "placement rules", "responsible city office", "providers", "closing arrangements", "written project scope"]) {
    assert.ok(body.includes(term), term);
  }
  assert.match(body, /borrower, address, home, title, foundation, lender, and program requirements/);
  assert.match(body, /specific address and application review by a participating lender/);
  assert.match(body, /not loan approval or a no-down-payment guarantee/);
  assert.match(body, /Home Placer provides a one-year builder warranty for defects/);
  assert.match(body, /separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company/);
  assert.match(body, /Coverage, exclusions, and claim procedures follow your written warranties/);
});

test("all existing key-page links remain available to retrieval clients", async () => {
  const { route, site } = manifestFixture();
  const body = await route.GET().text();
  for (const path of ["packages", "guides", "stories", "buyer-resources", "find-land", "warranty", "homes", "brands", "land-packages", "financing", "process", "faq", "locations", "blog", "contact"]) {
    assert.ok(body.includes(`(${site.url}/${path})`), path);
  }
});
