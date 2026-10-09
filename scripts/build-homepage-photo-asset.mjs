// Explicit frontend asset operation only. Normal builds serve the committed file.
// Use the locked Next encoder, never a different transitive sharp dependency.
// No remote downloads, crops, retouching, source replacement, or gallery rebuild.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextRequire = createRequire(import.meta.resolve("next/package.json"));
const sharp = nextRequire("sharp");

export const homepagePhoto = Object.freeze({
  source: "/models/ultra-flex-28-52/01.jpg",
  sourceSha256: "6711287279b470374c7f60f00761a859d16d6fd565c7c36252b2b1a4e9cf9f80",
  sourceWidth: 1600,
  sourceHeight: 899,
  destination: "/models/ultra-flex-28-52/01-homepage-960.webp",
  width: 960,
  height: 539,
  quality: 80,
  effort: 6,
  maxBytes: 98000,
  encodedSha256: "b98de869db174ccf0445d9a4b361aaab2bae77be1b6c46c7caec2e343b13573c",
});

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function buildHomepagePhotoAsset(root) {
  const source = path.join(root, "public", homepagePhoto.source);
  const destination = path.join(root, "public", homepagePhoto.destination);
  const original = await readFile(source);
  if (hash(original) !== homepagePhoto.sourceSha256)
    throw new Error("Homepage photo source changed; review the authentic source before encoding.");
  const metadata = await sharp(original).metadata();
  if (metadata.format !== "jpeg" || metadata.width !== homepagePhoto.sourceWidth ||
      metadata.height !== homepagePhoto.sourceHeight)
    throw new Error("Unexpected homepage photo source dimensions or format.");

  const encoded = await sharp(original)
    .resize({ width: homepagePhoto.width, withoutEnlargement: true })
    .webp({ quality: homepagePhoto.quality, effort: homepagePhoto.effort })
    .toBuffer();
  const output = await sharp(encoded).metadata();
  if (output.format !== "webp" || output.width !== homepagePhoto.width ||
      output.height !== homepagePhoto.height || encoded.length > homepagePhoto.maxBytes ||
      hash(encoded) !== homepagePhoto.encodedSha256)
    throw new Error("Homepage encoding differs from the reviewed output; inspect the encoder and quality before replacing it.");

  let existing;
  try {
    existing = await readFile(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (!existing.equals(encoded))
      throw new Error("Existing homepage photo differs; refusing to overwrite it.");
    return { written: 0, retained: 1, bytes: encoded.length };
  }
  await writeFile(destination, encoded, { flag: "wx" });
  return { written: 1, retained: 0, bytes: encoded.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2)
    throw new Error("Usage: node scripts/build-homepage-photo-asset.mjs");
  const result = await buildHomepagePhotoAsset(path.resolve(import.meta.dirname, ".."));
  console.log(JSON.stringify({ ...result, sharp: sharp.versions.sharp, webp: sharp.versions.webp }));
}
