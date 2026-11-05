import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import sharp from "sharp";
import { galleryFixture, renderGalleryImages } from "./fixtures/curated-gallery-preview.mjs";

const assets = JSON.parse(readFileSync("src/lib/curated-gallery-assets.json", "utf8"));
const manifest = JSON.parse(readFileSync("data/gallery-manifest.json", "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("every curated source and existing full-size WebP is byte-identical to the task base", () => {
  assert.deepEqual(Object.keys(assets).sort(), manifest.map(file => `/gallery/${file}`).sort());
  const files = [...Object.keys(assets).flatMap(src => [`public${src}`, `public${src.slice(0, -4)}.webp`]),
    "data/gallery-manifest.json"];
  for (const file of files)
    assert.equal(hash(readFileSync(file)), hash(execFileSync("git", ["show", `7b3f403:${file}`])), file);
});

test("a reviewed narrow photo with no smaller derivatives still has a nonempty truthful source set", () => {
  const { outputText } = ts.transpileModule(readFileSync("src/lib/curated-gallery-images.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const fixtureModule = { exports: {} };
  runInNewContext(outputText, { module: fixtureModule, exports: fixtureModule.exports, require: name => {
    if (name === "./asset") return { asset: value => value };
    assert.equal(name, "./curated-gallery-assets.json");
    return { "/gallery/home-01.jpg": { width: 150, widths: [] } };
  } });
  assert.equal(fixtureModule.exports.curatedGallerySrcSet("/gallery/home-01.jpg"), "/gallery/home-01.webp 150w");
  assert.equal(fixtureModule.exports.curatedGallerySrcSet("/gallery/unknown.jpg"), undefined);
});

test("all advertised candidates exist with truthful dimensions, same proportions, and no enlargement", async () => {
  for (const [src, { width, widths }] of Object.entries(assets)) {
    const original = await sharp(`public${src}`).metadata();
    assert.equal(width, original.width);
    assert.deepEqual(widths, [320, 480, 640, 768, 1200].filter(value => value < width));
    const set = galleryFixture.curatedGallerySrcSet(src);
    assert.ok(set && !set.includes("undefined") && !set.includes("NaN"));
    const candidates = set.split(", ").map(value => {
      const match = value.match(/^(\/gallery\/[^ ]+\.webp) (\d+)w$/);
      assert.ok(match, value);
      return { url: match[1], width: Number(match[2]) };
    });
    assert.deepEqual(candidates.map(candidate => candidate.width), [...widths, width]);
    for (const candidate of candidates) {
      const photo = await sharp(`public${candidate.url}`).metadata();
      assert.equal(photo.format, "webp");
      assert.equal(photo.width, candidate.width);
      assert.ok(photo.width <= original.width);
      assert.ok(Math.abs(photo.height - original.height * photo.width / original.width) <= 1);
    }
  }
});

test("actual server-rendered pictures preserve source URLs, alt, geometry, lazy loading and route sizing", () => {
  for (const layout of ["homepage", "masonry"]) {
    const html = renderGalleryImages(layout);
    const images = [...html.matchAll(/<img[^>]+>/g)].map(match => match[0]);
    assert.equal(images.length, layout === "homepage" ? 6 : 17);
    assert.match(html, /<source type="image\/webp" srcSet="\/gallery\/.+?-responsive-320\.webp 320w/);
    assert.equal((html.match(/sizes="/g) ?? []).length, images.length);
    for (const image of images) {
      assert.match(image, /src="\/gallery\/(?:home|dev)-\d{2}\.jpg"/);
      assert.match(image, /alt="Home Placer land development|alt="New manufactured home placed/);
      assert.match(image, /width="(?:1200|1600)" height="\d+"/);
      assert.match(image, /loading="lazy"/);
    }
    assert.doesNotMatch(html, /<script|_next\/image|loading="eager"/);
  }
  const unknown = "/gallery/unreviewed.jpg";
  assert.equal(galleryFixture.curatedGallerySrcSet(unknown), undefined);
  const html = renderGalleryImages("homepage", [{ src: unknown, webpSrc: "/gallery/unreviewed.webp",
    alt: "Fixture", category: "homes", width: 100, height: 75 }]);
  assert.match(html, /srcSet="\/gallery\/unreviewed\.webp"/);
  assert.doesNotMatch(html, /responsive-|sizes="|srcSet=""/);
});

function hintedSlot(sizes, viewport) {
  for (let value of sizes.split(", ")) {
    const condition = value.match(/^\(min-width: ([\d.]+)rem\) (.+)$/);
    if (condition) {
      if (viewport < Number(condition[1]) * 16) continue;
      value = condition[2];
    }
    if (/^[\d.]+rem$/.test(value)) return parseFloat(value) * 16;
    const divided = value.match(/^calc\(\(100vw - ([\d.]+)rem\) \/ (\d)\)$/);
    if (divided) return (viewport - Number(divided[1]) * 16) / Number(divided[2]);
    const single = value.match(/^calc\(100vw - ([\d.]+)rem\)$/);
    assert.ok(single, value);
    return viewport - Number(single[1]) * 16;
  }
  assert.fail("Missing default slot");
}

test("sizes match the actual shell, padding, breakpoints and gaps for both layouts", () => {
  for (const viewport of [375, 412, 639, 640, 767, 768, 1023, 1024, 1216, 1440]) {
    const padding = viewport >= 768 ? 64 : 40;
    const shell = Math.min(viewport, 1216) - padding;
    const homeColumns = viewport >= 640 ? 3 : 2;
    const galleryColumns = viewport >= 1024 ? 3 : viewport >= 640 ? 2 : 1;
    assert.ok(Math.abs(hintedSlot(galleryFixture.homepageWorkImageSizes, viewport)
      - (shell - 16 * (homeColumns - 1)) / homeColumns) < 0.01);
    assert.ok(Math.abs(hintedSlot(galleryFixture.galleryMasonryImageSizes, viewport)
      - (shell - 16 * (galleryColumns - 1)) / galleryColumns) < 0.01);
  }
  const home = readFileSync("src/app/page.tsx", "utf8");
  const gallery = readFileSync("src/app/gallery/page.tsx", "utf8");
  assert.match(home, /grid grid-cols-2 gap-4 sm:grid-cols-3/);
  assert.match(home, /sizes=\{homepageWorkImageSizes\}/);
  assert.match(gallery, /columns-1 gap-4 sm:columns-2 lg:columns-3/);
  assert.match(gallery, /sizes=\{galleryMasonryImageSizes\}/);
});

test("mobile DPR 2/3 candidate budgets materially reduce work-grid and masonry image bytes", () => {
  const images = galleryFixture.getGallery();
  const homeImages = [...images.filter(image => image.category === "homes").slice(0, 4),
    ...images.filter(image => image.category === "development").slice(0, 2)];
  for (const [items, sizes] of [[homeImages, galleryFixture.homepageWorkImageSizes], [images, galleryFixture.galleryMasonryImageSizes]]) {
    for (const viewport of [375, 412]) for (const dpr of [2, 3]) {
      let originalBytes = 0;
      let candidateBytes = 0;
      for (const image of items) {
        const candidates = image.webpSrcSet.split(", ").map(value => {
          const [url, width] = value.split(" ");
          return { url, width: parseInt(width) };
        });
        const candidate = candidates.find(value => value.width >= hintedSlot(sizes, viewport) * dpr) ?? candidates.at(-1);
        originalBytes += statSync(`public${image.webpSrc}`).size;
        candidateBytes += statSync(`public${candidate.url}`).size;
      }
      assert.ok(candidateBytes < originalBytes * 0.8, `${viewport}px DPR${dpr}: ${candidateBytes}/${originalBytes}`);
    }
  }
  // Budget model only: browser selection may also reflect network/cache policy.
});
