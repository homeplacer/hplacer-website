import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildHomepagePhotoAsset, homepagePhoto } from "../scripts/build-homepage-photo-asset.mjs";

const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourcePath = (root) => path.join(root, "public", homepagePhoto.source);
const targetPath = (root) => path.join(root, "public", homepagePhoto.destination);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hplacer-homepage-photo-assets-"));
  await mkdir(path.dirname(sourcePath(root)), { recursive: true });
  await copyFile(`public${homepagePhoto.source}`, sourcePath(root));
  return root;
}

test("homepage encoding reproduces the reviewed photo within budget, preserves originals/gallery, and is idempotent", async () => {
  const root = await fixture();
  try {
    const galleryPath = path.join(root, "public/models/ultra-flex-28-52/01-gallery-960.webp");
    await copyFile("public/models/ultra-flex-28-52/01-gallery-960.webp", galleryPath);
    const original = await readFile(sourcePath(root));
    const gallery = await readFile(galleryPath);
    const originalTime = (await stat(sourcePath(root))).mtimeMs;
    const galleryTime = (await stat(galleryPath)).mtimeMs;
    assert.equal(hash(original), homepagePhoto.sourceSha256);
    assert.equal(sharp.versions.sharp, "0.35.5");

    assert.deepEqual(await buildHomepagePhotoAsset(root), { written: 1, retained: 0, bytes: 97176 });
    const candidate = await readFile(targetPath(root));
    const metadata = await sharp(candidate).metadata();
    assert.deepEqual([metadata.format, metadata.width, metadata.height], ["webp", 960, 539]);
    assert.equal(hash(candidate), homepagePhoto.encodedSha256);
    assert.deepEqual(candidate, await readFile(`public${homepagePhoto.destination}`));
    assert.ok(candidate.length <= homepagePhoto.maxBytes);
    assert.ok(gallery.length - candidate.length >= 10000);
    assert.deepEqual(await readFile(sourcePath(root)), original);
    assert.deepEqual(await readFile(galleryPath), gallery);
    assert.equal((await stat(sourcePath(root))).mtimeMs, originalTime);
    assert.equal((await stat(galleryPath)).mtimeMs, galleryTime);

    await utimes(targetPath(root), new Date(0), new Date(0));
    const candidateTime = (await stat(targetPath(root))).mtimeMs;
    assert.deepEqual(await buildHomepagePhotoAsset(root), { written: 0, retained: 1, bytes: 97176 });
    assert.deepEqual(await readFile(targetPath(root)), candidate);
    assert.equal((await stat(targetPath(root))).mtimeMs, candidateTime);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unreviewed source bytes reject before writing a homepage candidate", async () => {
  const root = await fixture();
  try {
    const changed = Buffer.concat([await readFile(sourcePath(root)), Buffer.from("changed")]);
    await writeFile(sourcePath(root), changed);
    await assert.rejects(buildHomepagePhotoAsset(root), /Homepage photo source changed/);
    await assert.rejects(stat(targetPath(root)), { code: "ENOENT" });
    assert.deepEqual(await readFile(sourcePath(root)), changed);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unexpected existing homepage output is preserved rather than overwritten", async () => {
  const root = await fixture();
  try {
    const existing = Buffer.from("unreviewed existing output");
    await writeFile(targetPath(root), existing);
    await assert.rejects(buildHomepagePhotoAsset(root), /refusing to overwrite/);
    assert.deepEqual(await readFile(targetPath(root)), existing);
    assert.equal(hash(await readFile(sourcePath(root))), homepagePhoto.sourceSha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normal build and development commands do not regenerate homepage assets", async () => {
  const { scripts } = JSON.parse(await readFile("package.json", "utf8"));
  for (const command of Object.values(scripts))
    assert.doesNotMatch(command, /build-homepage-photo-asset/);
});
