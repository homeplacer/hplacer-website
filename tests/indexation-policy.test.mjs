import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const loadSource = (source, imports = {}) => {
  const { outputText } = ts.transpileModule(source, {
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
const load = (path, imports = {}) => loadSource(read(path), imports);

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
  const entries = await sitemap();
  const homepages = entries.filter((entry) => new URL(entry.url).pathname === "/");
  assert.equal(homepages.length, 1);
  assert.equal(homepages[0].url, new URL("/", site.url).href);
  assert.equal(homepages[0].priority, 1);
  const urls = entries.map((entry) => new URL(entry.url));
  assert.ok(urls.every((url) => url.origin === new URL(site.url).origin && url.search === "" && url.hash === ""));
  assert.deepEqual(
    urls.filter((url) => url.pathname.startsWith("/locations/")).map((url) => url.pathname).sort(),
    Object.keys(evidence).map((slug) => `/locations/${slug}`).sort(),
  );
});

test("homepage slash normalization preserves the full offline sitemap versus the pre-change negative control", async () => {
  const imports = {
    "@/lib/location-evidence": { locationEvidence },
    "@/lib/packages": { getPackages: () => [{ id: "fixture-package", lastVerifiedAt: "2026-10-01" }] },
    "@/lib/guides": { guides: [{ slug: "fixture-guide", sourceCheckedAt: "2026-10-02" }] },
    "@/lib/site": { site },
    "@/lib/homes": { getAllHomes: () => [
      { slug: "fixture-model", imageUrls: ["/models/fixture/01.jpg", "https://example.test/photo.jpg"] },
      { slug: "fixture-no-photo", imageUrls: [] },
    ] },
    "@/lib/blog": { getAllPosts: () => [
      { slug: "fixture-post", date: "2026-10-03" },
      { slug: "fixture-undated-post", date: null },
    ] },
    "@/lib/locations": locationData,
    "@/lib/placed-homes": { getAllPlacedHomes: () => [
      { slug: "fixture-project", closeDate: "2026-10-04", photo: "/placed/fixture/01.jpg", photos: ["/placed/fixture/01.jpg", "/placed/fixture/02.jpg"] },
      { slug: "fixture-undated-project", closeDate: null, photo: "/placed/fixture/03.jpg", photos: [] },
    ] },
    "@/lib/forturro-package-feed": {
      getLivePackageListings: async () => [
        { slug: "fixture-live", photoUrl: "https://example.test/listing.jpg" },
        { slug: "fixture-live-no-photo", photoUrl: null },
      ],
      packageSlug: (listing) => listing.slug,
    },
  };
  // Reconstruct only the pre-change root expression, without requiring Git
  // history in a shallow checkout or an exported source tree.
  const currentSource = read("src/app/sitemap.ts");
  const rootExpression = 'url: `${base}${p || "/"}`,';
  assert.equal(currentSource.split(rootExpression).length - 1, 1);
  const previousSource = currentSource.replace(rootExpression, 'url: `${base}${p}`,');
  const previous = loadSource(previousSource, imports);
  const current = loadSource(currentSource, imports);
  const previousEntries = await previous.default();
  assert.equal(previousEntries.filter((entry) => entry.url === site.url).length, 1);
  const expected = previousEntries.map((entry) =>
    entry.url === site.url ? { ...entry, url: new URL("/", site.url).href } : entry,
  );
  assert.deepEqual(await current.default(), expected);
  assert.equal(current.revalidate, previous.revalidate);
});
