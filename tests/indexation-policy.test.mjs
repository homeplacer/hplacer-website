import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
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

const site = {
  ...JSON.parse(read("data/business-identity.json")),
  name: "Home Placer",
  blurb: "Home Placer manufactured homes",
};
const evidence = JSON.parse(read("data/location-evidence.json"));
const { locationEvidence } = load("src/lib/location-evidence.ts", {
  "../../data/location-evidence.json": evidence,
});
const locationData = load("src/lib/locations.ts");
const { pageMetadata } = load("src/lib/metadata.ts", { "./site": { site } });
const common = {
  "react/jsx-runtime": {},
  "next/link": {},
  "@/lib/metadata": { pageMetadata },
  "@/lib/homes": {},
  "@/lib/jsonld": {},
};

test("catalog filters share the catalog canonical rather than becoming separate landing pages", () => {
  const { metadata } = load("src/app/homes/page.tsx", {
    ...common,
    "@/components/homes-browser": {},
  });
  for (const view of [
    "/homes?brand=Cavco",
    "/homes?brand=Champion",
    "/homes?brand=Clayton",
    "/homes?wall=drywall",
  ]) {
    const canonical = new URL(metadata.alternates.canonical, site.url);
    assert.equal(new URL(view, site.url).pathname, canonical.pathname, view);
    assert.equal(canonical.href, `${site.url}/homes`, view);
    assert.equal(metadata.openGraph.url, "/homes");
  }
});

test("model project filters share the archive canonical without using noindex for consolidation", () => {
  const { metadata } = load("src/app/packages/page.tsx", {
    ...common,
    "@/components/page-hero": {},
    "@/lib/packages": {},
    "@/components/home-inquiry-dialog": {},
  });
  for (const model of [
    "birdie", "hey-jude", "pinehurst", "sebastian", "stayin-alive",
    "tanglewood", "ultra-flex-28-52", "ultra-flex-28-68",
  ]) {
    const view = new URL(`/packages?model=${model}`, site.url);
    const canonical = new URL(metadata.alternates.canonical, site.url);
    assert.equal(view.pathname, canonical.pathname, model);
    assert.equal(canonical.href, `${site.url}/packages`, model);
  }
  assert.equal(metadata.openGraph.url, "/packages");
  assert.notEqual(metadata.robots?.index, false);
});

test("every service area is available while indexability follows its recorded project evidence", async () => {
  const { generateMetadata, generateStaticParams } = load("src/app/locations/[slug]/page.tsx", {
    ...common,
    "@/lib/location-evidence": { locationEvidence },
    "../../../../data/locations-manifest.json": {},
    "next/navigation": {},
    "@/lib/locations": locationData,
    "@/components/home-card": {},
    "@/lib/site": { site },
    "@/lib/asset": {},
    "@/components/icons": {},
    "@/lib/contact-context": {},
  });
  assert.deepEqual(generateStaticParams(), locationData.locations.map(({ slug }) => ({ slug })));
  for (const location of locationData.locations) {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: location.slug }) });
    const expectedCanonical = `/locations/${location.slug}`;
    assert.equal(metadata.alternates.canonical, expectedCanonical, location.slug);
    assert.equal(metadata.openGraph.url, expectedCanonical, location.slug);
    assert.deepEqual(metadata.robots, { index: Boolean(evidence[location.slug]), follow: true }, location.slug);
  }
  assert.equal((await generateMetadata({ params: Promise.resolve({ slug: "not-a-service-area" }) })).title, "Location not found");
});

test("indexed location evidence matches real town identities and the existing archive", () => {
  const placedHomes = JSON.parse(read("data/placed-homes.json"));
  for (const [slug, record] of Object.entries(evidence)) {
    const location = locationData.getLocation(slug);
    assert.ok(location, slug);
    assert.equal(record.market, location.name, slug);
    assert.equal(record.source, "data/placed-homes.json", slug);
    assert.equal(record.publicProjectCount, placedHomes.filter((home) => home.town === record.market).length, slug);
    assert.ok(record.publicProjectCount > 0, slug);
    assert.match(record.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("sitemap has one homepage and only evidence-backed location pages with no filter variants", async () => {
  // Inventory providers are isolated: this regression test never contacts an
  // MLS endpoint, changes cache behavior, or sends a production lead.
  const { default: sitemap } = load("src/app/sitemap.ts", {
    "@/lib/location-evidence": { locationEvidence },
    "@/lib/packages": { getPackages: () => [] },
    "@/lib/guides": { guides: [] },
    "@/lib/site": { site },
    "@/lib/homes": { getAllHomes: () => [] },
    "@/lib/blog": { getAllPosts: () => [] },
    "@/lib/locations": locationData,
    "@/lib/placed-homes": { getAllPlacedHomes: () => [] },
    "@/lib/forturro-package-feed": { getLivePackageListings: async () => [], packageSlug: () => "unused" },
  });
  const urls = (await sitemap()).map((entry) => new URL(entry.url));
  assert.equal(urls.filter((url) => url.pathname === "/").length, 1);
  assert.equal(urls.find((url) => url.pathname === "/").href, new URL(site.url).href);
  assert.ok(urls.every((url) => url.origin === new URL(site.url).origin && url.search === "" && url.hash === ""));
  assert.deepEqual(
    urls.filter((url) => url.pathname.startsWith("/locations/")).map((url) => url.pathname).sort(),
    Object.keys(evidence).map((slug) => `/locations/${slug}`).sort(),
  );
});
