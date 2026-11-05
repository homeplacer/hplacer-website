import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { publishedProjects, projectFixture, renderProjectCard, renderModelProjects,
  renderStories, renderRelatedProjects, renderHomepageProjects } from "./fixtures/historical-project-preview.mjs";

const assets = JSON.parse(readFileSync("src/lib/historical-project-assets.json", "utf8"));
const slugsIn = html => [...html.matchAll(/href="\/recently-placed\/([^"]+)"/g)].map(match => match[1]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

test("all model past-project sections retain their original selected links, prices and recorded project photos", async () => {
  const before = JSON.stringify(publishedProjects);
  for (const model of projectFixture.getAllHomes()) {
    const sold = publishedProjects.filter(home => home.modelSlug === model.slug && home.price > 0 && home.closeDate);
    if (!sold.length || projectFixture.isRetiredHome(model.slug)) continue;
    const html = await renderModelProjects(model.slug);
    assert.deepEqual(slugsIn(html), sold.slice(0, 3).map(home => home.slug), model.slug);
    assert.equal(new Set(slugsIn(html)).size, Math.min(3, sold.length));
    assert.ok(html.includes(`Our ${sold.length} recorded completed`), model.slug);
    assert.match(html, /historical sale prices, not current quotes/);
    for (const home of sold.slice(0, 3)) {
      assert.ok(html.includes(`src="${home.photo}"`));
      assert.ok(html.includes(escape(home.address)));
      assert.ok(html.includes(`Sold for ${projectFixture.formatPrice(home.price)}`));
      assert.ok(html.includes(`Closed ${home.closeDate} · View project`));
    }
    assert.equal((html.match(/loading="lazy"/g) ?? []).length, Math.min(3, sold.length));
    assert.doesNotMatch(html, /loading="eager"|fetch[Pp]riority="high"|<script|_next\/image/);
  }
  assert.equal(JSON.stringify(publishedProjects), before);
});

test("shared cards remain ordinary crawlable links with explicit sold history and no invented photo variants", () => {
  for (const home of publishedProjects) {
    const html = renderProjectCard(home);
    assert.equal(slugsIn(html).length, 1);
    assert.match(html, /Historical project · Not available/);
    assert.match(html, /loading="lazy" decoding="async"/);
    assert.match(html, /fetch[Pp]riority="low"/);
    assert.match(html, /aspect-\[4\/3\].*object-cover/);
    assert.ok(html.includes(`alt="${escape(`Home placed at ${home.address}, ${home.town}`)}"`));
    assert.match(html, /<source type="image\/webp"/);
  }
  for (const photo of ["/unknown.jpg", "https://example.test/photo.jpg", "toString"]) {
    const html = renderProjectCard({ ...publishedProjects[0], photo, price: 0, closeDate: null });
    assert.equal(projectFixture.historicalProjectPhoto(photo), undefined);
    assert.doesNotMatch(html, /<source|<picture|sizes=|Sold for|Closed null|undefined/);
  }
  assert.doesNotMatch(renderProjectCard({ ...publishedProjects[0], photo: "" }), /<img|<picture/);
});

test("town stories and homepage preserve original newest-three selection; related links retain their graph", async () => {
  const byTown = new Map();
  for (const home of publishedProjects) {
    if (!byTown.has(home.town)) byTown.set(home.town, []);
    byTown.get(home.town).push(home);
  }
  const stories = renderStories();
  const expected = [...byTown.values()].flatMap(homes => [...homes]
    .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? "")).slice(0, 3).map(home => home.slug));
  assert.deepEqual([...slugsIn(stories)].sort(), [...expected].sort());
  assert.equal(new Set(slugsIn(stories)).size, expected.length);
  assert.match(stories, /These are past projects/);
  const latest = publishedProjects.filter(home => home.photo && home.price > 0 && home.closeDate)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate)).slice(0, 3);
  assert.deepEqual(slugsIn(renderHomepageProjects()), latest.map(home => home.slug));
  for (const home of publishedProjects) {
    const html = await renderRelatedProjects(home.slug);
    const links = slugsIn(html);
    assert.equal(links.length, 3);
    assert.equal(new Set(links).size, 3);
    assert.equal(links.includes(home.slug), false);
    assert.equal((html.match(/loading="lazy"/g) ?? []).length, 3);
  }
});

test("every responsive source preserves exact original bytes, truthful dimensions and non-upscaled local variants", async () => {
  assert.deepEqual(Object.keys(assets).sort(), [...new Set(publishedProjects.map(home => home.photo))].sort());
  for (const [source, photo] of Object.entries(assets)) {
    const original = readFileSync(`public${source}`);
    assert.equal(hash(original), photo.sourceSha256, source);
    const info = await sharp(original).metadata();
    assert.equal(info.width, photo.width);
    assert.equal(info.height, photo.height);
    assert.deepEqual(photo.widths, [...new Set([320, 480, 640, 960].filter(width => width < info.width).concat(info.width))]);
    const responsive = projectFixture.historicalProjectPhoto(source);
    for (const width of photo.widths) {
      const file = `${source.slice(0, -4)}-sold-${width}.webp`;
      const bytes = readFileSync(`public${file}`);
      assert.ok(bytes.length > 0);
      const variant = await sharp(bytes).metadata();
      assert.equal(variant.format, "webp");
      assert.equal(variant.width, width);
      assert.ok(width <= photo.width);
      assert.ok(Math.abs(variant.height - photo.height * width / photo.width) <= 1);
      assert.ok(responsive.srcSet.includes(`${file} ${width}w`));
    }
  }
});

test("responsive hints reflect each actual grid shell, inset, gap and breakpoint", () => {
  for (const viewport of [320, 375, 412, 639, 640, 767, 768, 1023, 1024, 1216, 1280, 1920]) {
    const shell = Math.min(viewport, 1216) - (viewport >= 768 ? 64 : 40);
    const columns = viewport >= 1024 ? 3 : viewport >= 640 ? 2 : 1;
    for (const inset of [0, 50]) {
      const actual = (shell - inset - 16 * (columns - 1)) / columns - 2;
      const hinted = viewport >= 1216 ? (inset ? 22.166667 : 23.208333) * 16
        : viewport >= 1024 ? (viewport - 96 - inset) / 3 - 2
        : viewport >= 768 ? (viewport - 80 - inset) / 2 - 2
        : viewport >= 640 ? (viewport - 56 - inset) / 2 - 2
        : viewport - 42 - inset;
      assert.ok(Math.abs(actual - hinted) < 0.001, `${viewport}, inset=${inset}`);
    }
  }
  assert.equal(projectFixture.insetProjectImageSizes,
    "(min-width: 76rem) 22.166667rem, (min-width: 64rem) calc((100vw - 9.125rem) / 3 - 2px), (min-width: 48rem) calc((100vw - 8.125rem) / 2 - 2px), (min-width: 40rem) calc((100vw - 6.625rem) / 2 - 2px), calc(100vw - 5.75rem)");
  assert.equal(projectFixture.relatedProjectImageSizes,
    "(min-width: 76rem) 23.208333rem, (min-width: 64rem) calc((100vw - 6rem) / 3 - 2px), (min-width: 48rem) calc((100vw - 5rem) / 2 - 2px), (min-width: 40rem) calc((100vw - 3.5rem) / 2 - 2px), calc(100vw - 2.625rem)");
  const serverCard = readFileSync("src/components/historical-project-card.tsx", "utf8");
  assert.doesNotMatch(serverCard, /["']use client["']|useState|useEffect/);
  const clientGrid = readFileSync("src/components/placed-homes.tsx", "utf8");
  assert.doesNotMatch(clientGrid, /historical-project-assets|historical-project-images|historical-project-card/);
});
