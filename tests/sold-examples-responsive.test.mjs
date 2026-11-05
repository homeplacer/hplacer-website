import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { soldFixture, renderSoldExamples } from "./fixtures/sold-examples-preview.mjs";

const assets = JSON.parse(readFileSync("src/lib/sold-example-assets.json", "utf8"));
const homes = JSON.parse(readFileSync("data/placed-homes.json", "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("originals match the encoder's source hashes and rendering does not mutate historical records", () => {
  for (const [source, asset] of Object.entries(assets))
    assert.equal(hash(readFileSync(`public${source}`)), asset.sourceSha256, source);
  const items = structuredClone(homes);
  const before = structuredClone(items);
  renderSoldExamples(items);
  assert.deepEqual(items, before);
});

test("every advertised asset is encoded from its exact original without crop or upscale", async () => {
  for (const [source, asset] of Object.entries(assets)) {
    const bytes = readFileSync(`public${source}`);
    assert.equal(hash(bytes), asset.sourceSha256);
    const original = await sharp(bytes).metadata();
    assert.equal(asset.width, original.width);
    assert.equal(asset.height, original.height);
    assert.deepEqual(asset.widths, [...new Set([320, 480, 640, 960].filter(width => width < original.width).concat(original.width))]);
    const photo = soldFixture.soldExamplePhoto(source);
    assert.ok(photo.srcSet && !photo.srcSet.includes("undefined"));
    for (const width of asset.widths) {
      const file = `public${source.slice(0, -4)}-sold-${width}.webp`;
      const candidate = readFileSync(file);
      assert.ok(candidate.length);
      const info = await sharp(candidate).metadata();
      assert.equal(info.format, "webp");
      assert.equal(info.width, width);
      assert.ok(info.width <= original.width);
      assert.ok(Math.abs(info.height - original.height * width / original.width) <= 1);
      assert.deepEqual(candidate, await sharp(bytes).resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 }).toBuffer());
      assert.ok(photo.srcSet.includes(`${source.slice(0, -4)}-sold-${width}.webp ${width}w`));
    }
  }
});

test("actual SSR preserves dynamic latest-three selection, links, sold prices and JPEG fallbacks", () => {
  const selected = homes.filter(home => home.photo && home.price > 0 && home.closeDate)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate)).slice(0, 3);
  const html = renderSoldExamples();
  const knownPhotos = selected.filter(home => soldFixture.soldExamplePhoto(home.photo)).length;
  assert.equal((html.match(/<picture\b/g) ?? []).length, knownPhotos);
  assert.equal((html.match(/<source type="image\/webp"/g) ?? []).length, knownPhotos);
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(imgs.length, selected.length);
  selected.forEach((home, index) => {
    assert.ok(imgs[index].includes(`src="${home.photo}"`));
    assert.match(imgs[index], /loading="lazy"/);
    assert.match(imgs[index], /aspect-\[4\/3\].*object-cover/);
    assert.ok(html.includes(`href="/recently-placed/${home.slug}"`));
    assert.ok(html.includes(`Sold for $${home.price.toLocaleString("en-US")}`));
    assert.ok(html.includes(`Closed ${home.closeDate} · View project`));
  });
  assert.doesNotMatch(html, /<script|_next\/image|loading="eager"/);
});

test("changed selection and unknown/remote photos retain the original-only image path", () => {
  const home = (slug, closeDate, photo = `/recently-placed/unreviewed/${slug}.jpg`, price = 200000) =>
    ({ ...homes[0], slug, address: `Fixture ${slug}`, photo, closeDate, price });
  const items = [home("old", "2020-01-01"), home("new", "2026-10-06", "https://example.test/photo.jpg"),
    home("middle", "2025-01-01"), home("last", "2024-01-01"), home("no-price", "2030-01-01", "/unknown.jpg", 0),
    home("no-date", null), home("no-photo", "2030-01-01", "")];
  const html = renderSoldExamples(items);
  assert.deepEqual([...html.matchAll(/href="\/recently-placed\/([^"]+)"/g)].map(match => match[1]), ["new", "middle", "last"]);
  assert.doesNotMatch(html, /<picture|<source|sizes=|srcSet=/);
  assert.match(html, /src="https:\/\/example.test\/photo.jpg"/);
  assert.equal(soldFixture.soldExamplePhoto("/unknown.jpg"), undefined);
  assert.equal(soldFixture.soldExamplePhoto("toString"), undefined);
});

function hintedSlot(viewport) {
  if (viewport >= 1216) return 366;
  if (viewport >= 768) return (viewport - 112) / 3 - 2;
  if (viewport >= 640) return (viewport - 88) / 3 - 2;
  return viewport - 42;
}

test("sizes describe real padding, borders, gap and breakpoints rather than viewport thirds", () => {
  assert.equal(soldFixture.soldExampleImageSizes,
    "(min-width: 76rem) 22.875rem, (min-width: 48rem) calc((100vw - 7rem) / 3 - 2px), (min-width: 40rem) calc((100vw - 5.5rem) / 3 - 2px), calc(100vw - 2.625rem)");
  for (const viewport of [320, 375, 412, 639, 640, 767, 768, 1023, 1216, 1280, 1920]) {
    const inner = Math.min(viewport, 1216) - (viewport >= 768 ? 64 : 40);
    const columns = viewport >= 640 ? 3 : 1;
    assert.ok(Math.abs(hintedSlot(viewport) - ((inner - 24 * (columns - 1)) / columns - 2)) < 0.001);
  }
  assert.match(readFileSync("src/components/sold-examples.tsx", "utf8"), /grid gap-6 sm:grid-cols-3/);
});

test("native source sets contain exactly the verified candidates, with nonempty unique width descriptors", () => {
  for (const [source, asset] of Object.entries(assets)) {
    const candidates = soldFixture.soldExamplePhoto(source).srcSet.split(", ");
    assert.ok(candidates.length);
    assert.deepEqual(candidates, asset.widths.map(width => `${source.slice(0, -4)}-sold-${width}.webp ${width}w`));
    assert.equal(new Set(candidates).size, candidates.length);
    assert.ok(asset.widths.every(width => Number.isInteger(width) && width > 0));
  }
});
