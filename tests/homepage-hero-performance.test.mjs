import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { homepagePhoto } from "../scripts/build-homepage-photo-asset.mjs";

const page = readFileSync("src/app/page.tsx", "utf8");
const hero = page.match(/<picture>[\s\S]*?<\/picture>/)?.[0];
const candidates = [...hero.matchAll(/asset\("([^"]+)"\)\} (\d+)w/g)].map(
  ([, path, width]) => ({ path, width: Number(width) }),
);

test("the homepage offers an existing mid-size authentic hero without an image-service dependency", async () => {
  assert.deepEqual(candidates.map(({ width }) => width), [640, 960, 1200]);
  for (const { path, width } of candidates) {
    const file = `public${path}`;
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, width);
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    if (path === homepagePhoto.destination) {
      // The new homepage-only encoding is pinned to the unchanged authentic
      // source and visually reviewed output, preserving the shared gallery.
      assert.equal(hash(readFileSync(`public${homepagePhoto.source}`)), homepagePhoto.sourceSha256);
      assert.equal(hash(readFileSync(file)), homepagePhoto.encodedSha256);
      assert.equal(metadata.height, homepagePhoto.height);
      assert.ok(statSync(file).size <= homepagePhoto.maxBytes);
    } else {
      // The established 640w/1200w candidates remain byte-for-byte unchanged.
      const previous = execFileSync("git", ["show", `origin/main:${file}`]);
      assert.equal(hash(readFileSync(file)), hash(previous), file);
    }
  }
  assert.equal(candidates[1].path, homepagePhoto.destination);
  assert.ok(statSync(`public${candidates[1].path}`).size < statSync(`public${candidates[2].path}`).size * 0.75);
  assert.doesNotMatch(hero, /_next\/image|loader=|https?:\/\//);
});

test("hero slot hints follow the bounded layout, including tablet padding and desktop inset", () => {
  assert.match(hero, /sizes="\(min-width: 76rem\) 31\.36rem, \(min-width: 64rem\) calc\(48vw - 5\.12rem\), \(min-width: 48rem\) calc\(100vw - 4rem\), calc\(100vw - 2\.5rem\)"/);
  assert.match(page, /lg:grid-cols-\[1\.04fr_0\.96fr\]/);
  assert.match(page, /gap-10/);
  assert.match(page, /relative lg:pl-8/);
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /max-width: 76rem/);
  assert.match(css, /padding-inline: 1\.25rem/);
  assert.match(css, /padding-inline: 2rem/);
});

test("the fallback, reserved layout, and early image discovery remain unchanged", () => {
  assert.match(hero, /src=\{asset\("\/models\/ultra-flex-28-52\/01\.jpg"\)\}/);
  assert.match(hero, /alt="A new Home Placer manufactured home on its land in Horry County, SC"/);
  assert.match(hero, /width=\{1200\} height=\{900\} loading="eager" fetchPriority="high"/);
  assert.match(hero, /aspect-\[4\/3\] w-full/);
  assert.doesNotMatch(hero, /<script|use client|loading="lazy"/);
  assert.match(page, /label="Message us"/);
  assert.match(page, /href=\{`tel:\$\{site\.phoneDial\}`\}/);
  assert.match(page, /href=\{`mailto:\$\{site\.email\}`\}/);
});
