import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { buildModelGalleryAssets } from "../scripts/build-model-gallery-assets.mjs";

test("gallery encoding adds missing candidates and repeated runs retain existing bytes and timestamps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hplacer-gallery-assets-"));
  try {
    await mkdir(path.join(root, "data"));
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    await mkdir(path.join(root, "public/models/eclipse"), { recursive: true });
    const source = "/models/eclipse/03.jpg";
    const originalPath = path.join(root, "public", source);
    await copyFile(`public${source}`, originalPath);
    await writeFile(path.join(root, "data/models.json"), JSON.stringify([
      { slug: "eclipse", imageUrls: [source, "https://example.com/remote.jpg"] },
    ]));
    const existingPath = originalPath.slice(0, -4) + "-gallery-960.webp";
    await copyFile(`public${source.slice(0, -4)}-gallery-960.webp`, existingPath);
    const originalBytes = await readFile(originalPath);
    const existingBytes = await readFile(existingPath);
    await utimes(existingPath, new Date(0), new Date(0));
    const existingTime = (await stat(existingPath)).mtimeMs;

    const first = await buildModelGalleryAssets(root);
    assert.deepEqual(first, { written: 5, retained: 1, sources: 1, manifestUpdated: true });
    const manifestPath = path.join(root, "src/lib/model-gallery-assets.json");
    assert.deepEqual(JSON.parse(await readFile(manifestPath, "utf8")), {
      [source]: [160, 320, 640, 768, 960, 1280],
    });
    assert.deepEqual(await readFile(originalPath), originalBytes);
    assert.deepEqual(await readFile(existingPath), existingBytes);
    assert.equal((await stat(existingPath)).mtimeMs, existingTime);
    const candidatePath = originalPath.slice(0, -4) + "-gallery-768.webp";
    const candidateBytes = await readFile(candidatePath);
    const candidate = await sharp(candidatePath).metadata();
    assert.equal(candidate.width, 768);
    assert.equal(candidate.height, 432);
    await utimes(candidatePath, new Date(0), new Date(0));
    await utimes(manifestPath, new Date(0), new Date(0));
    const candidateTime = (await stat(candidatePath)).mtimeMs;
    const manifestTime = (await stat(manifestPath)).mtimeMs;

    const repeated = await buildModelGalleryAssets(root);
    assert.deepEqual(repeated, { written: 0, retained: 6, sources: 1, manifestUpdated: false });
    assert.deepEqual(await readFile(candidatePath), candidateBytes);
    assert.equal((await stat(candidatePath)).mtimeMs, candidateTime);
    assert.equal((await stat(manifestPath)).mtimeMs, manifestTime);

    // A deliberate original replacement uses the explicit rebuild path.
    const replacementBytes = await readFile("public/models/eclipse/04.jpg");
    await writeFile(originalPath, replacementBytes);
    const replaced = await buildModelGalleryAssets(root, { rebuild: true });
    assert.deepEqual(replaced, { written: 6, retained: 0, sources: 1, manifestUpdated: false });
    assert.notDeepEqual(await readFile(candidatePath), candidateBytes);
    assert.deepEqual(await readFile(originalPath), replacementBytes);
    await utimes(candidatePath, new Date(0), new Date(0));
    const rebuiltTime = (await stat(candidatePath)).mtimeMs;
    const unchangedRebuild = await buildModelGalleryAssets(root, { rebuild: true });
    assert.deepEqual(unchangedRebuild, { written: 0, retained: 6, sources: 1, manifestUpdated: false });
    assert.equal((await stat(candidatePath)).mtimeMs, rebuiltTime);

    // Invalid existing files fail explicitly rather than being overwritten.
    const malformedPath = originalPath.slice(0, -4) + "-gallery-160.webp";
    const malformedBytes = await sharp(originalPath).resize({ width: 80 }).webp().toBuffer();
    await writeFile(malformedPath, malformedBytes);
    await assert.rejects(buildModelGalleryAssets(root), /Invalid existing gallery variant/);
    assert.deepEqual(await readFile(malformedPath), malformedBytes);
    const repaired = await buildModelGalleryAssets(root, { rebuild: true });
    assert.equal(repaired.written, 1);
    assert.equal((await sharp(malformedPath).metadata()).width, 160);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("narrow originals cap and deduplicate candidates without upscaling", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hplacer-gallery-narrow-"));
  try {
    await mkdir(path.join(root, "data"));
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    await mkdir(path.join(root, "public/models/eclipse"), { recursive: true });
    const source = "/models/eclipse/03.jpg";
    const originalPath = path.join(root, "public", source);
    const narrowBytes = await sharp(await readFile(`public${source}`))
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg()
      .toBuffer();
    await writeFile(originalPath, narrowBytes);
    await writeFile(path.join(root, "data/models.json"), JSON.stringify([
      { slug: "eclipse", imageUrls: [source] },
    ]));

    const result = await buildModelGalleryAssets(root);
    assert.deepEqual(result, { written: 3, retained: 0, sources: 1, manifestUpdated: true });
    const manifest = JSON.parse(await readFile(path.join(root, "src/lib/model-gallery-assets.json"), "utf8"));
    assert.deepEqual(manifest[source], [160, 320, 400]);
    const original = await sharp(narrowBytes).metadata();
    for (const width of manifest[source]) {
      const variant = await sharp(originalPath.slice(0, -4) + `-gallery-${width}.webp`).metadata();
      assert.equal(variant.width, width);
      assert.ok(variant.width <= original.width);
      assert.ok(Math.abs(variant.height - original.height * width / original.width) <= 1);
    }
    assert.deepEqual(await readFile(originalPath), narrowBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
