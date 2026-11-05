import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { buildCuratedGalleryAssets } from "../scripts/build-curated-gallery-assets.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hplacer-curated-gallery-"));
  await mkdir(path.join(root, "data"));
  await mkdir(path.join(root, "src/lib"), { recursive: true });
  await mkdir(path.join(root, "public/gallery"), { recursive: true });
  await writeFile(path.join(root, "data/gallery-manifest.json"), JSON.stringify(["home-01.jpg"]));
  for (const file of ["home-01.jpg", "home-01.webp"])
    await copyFile(`public/gallery/${file}`, path.join(root, "public/gallery", file));
  return root;
}

test("repeatable encoding preserves source/full-size bytes and unchanged candidate timestamps", async () => {
  const root = await fixture();
  try {
    const source = path.join(root, "public/gallery/home-01.jpg");
    const full = source.replace(/\.jpg$/, ".webp");
    const sourceBytes = await readFile(source);
    const fullBytes = await readFile(full);
    assert.deepEqual(await buildCuratedGalleryAssets(root), { written: 5, retained: 0, sources: 1, manifestUpdated: true });
    const candidate = source.replace(/\.jpg$/, "-responsive-480.webp");
    const bytes = await readFile(candidate);
    // Exact reproduction from this source guards against a different photo/crop.
    assert.deepEqual(bytes, await sharp(sourceBytes).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer());
    await utimes(candidate, new Date(0), new Date(0));
    const before = (await stat(candidate)).mtimeMs;
    assert.deepEqual(await buildCuratedGalleryAssets(root), { written: 0, retained: 5, sources: 1, manifestUpdated: false });
    assert.equal((await stat(candidate)).mtimeMs, before);
    assert.deepEqual(await readFile(source), sourceBytes);
    assert.deepEqual(await readFile(full), fullBytes);
    assert.deepEqual(await buildCuratedGalleryAssets(root, { rebuild: true }), { written: 0, retained: 5, sources: 1, manifestUpdated: false });
    assert.equal((await stat(candidate)).mtimeMs, before);
    await writeFile(candidate, await sharp(sourceBytes).resize({ width: 320 }).webp().toBuffer());
    await assert.rejects(buildCuratedGalleryAssets(root), /Invalid existing curated variant/);
    assert.equal((await buildCuratedGalleryAssets(root, { rebuild: true })).written, 1);
    assert.equal((await sharp(candidate).metadata()).width, 480);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a narrow original keeps a nonempty full-size-only manifest without upscaling", async () => {
  const root = await fixture();
  try {
    const source = path.join(root, "public/gallery/home-01.jpg");
    const bytes = await sharp(await readFile(source)).resize({ width: 150 }).jpeg().toBuffer();
    await writeFile(source, bytes);
    await writeFile(source.replace(/\.jpg$/, ".webp"), await sharp(bytes).webp().toBuffer());
    assert.deepEqual(await buildCuratedGalleryAssets(root), { written: 0, retained: 0, sources: 1, manifestUpdated: true });
    const manifest = JSON.parse(await readFile(path.join(root, "src/lib/curated-gallery-assets.json"), "utf8"));
    assert.deepEqual(manifest, { "/gallery/home-01.jpg": { width: 150, widths: [] } });
    assert.deepEqual(await readFile(source), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unexpected sources and mismatched full-size assets fail instead of advertising guessed files", async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, "data/gallery-manifest.json"), JSON.stringify(["../outside.jpg"]));
    await assert.rejects(buildCuratedGalleryAssets(root), /Unexpected curated gallery source/);
    await writeFile(path.join(root, "data/gallery-manifest.json"), JSON.stringify(["home-01.jpg"]));
    const full = path.join(root, "public/gallery/home-01.webp");
    const bad = await sharp(await readFile(full)).resize({ width: 100 }).webp().toBuffer();
    await writeFile(full, bad);
    await assert.rejects(buildCuratedGalleryAssets(root), /Invalid full-size curated WebP/);
    assert.deepEqual(await readFile(full), bad);
  } finally { await rm(root, { recursive: true, force: true }); }
});
