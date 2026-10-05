// Repeatable frontend asset encoding only: no retouching, source-catalog edits,
// remote downloads, image service, or runtime/backend dependency.
// Prerequisite: npm ci installs the repository's currently locked Next/sharp
// dependency tree. Normal builds use committed assets without running encoding.
// Default runs add missing sizes from unchanged, reviewed source photos. After
// deliberately replacing an original or changing encoding settings, run:
// node scripts/build-model-gallery-assets.mjs --rebuild
// Same-dimension content replacements also require --rebuild: dimensions alone
// cannot detect changed source pixels in an incremental run.
// Rebuild re-encodes current originals, but writes only changed derivative bytes.
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

async function existingFile(file) {
  try {
    return await stat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function buildModelGalleryAssets(root, { rebuild = false } = {}) {
  const models = JSON.parse(
    await readFile(path.join(root, "data/models.json"), "utf8"),
  );
  const manifest = {};
  let written = 0;
  let retained = 0;
  for (const model of models) {
    for (const source of model.imageUrls) {
      if (!source.startsWith("/models/")) continue;
      if (!new RegExp(`^/models/${model.slug}/\\d{2}\\.jpg$`).test(source))
        throw new Error(`Unexpected local gallery source for ${model.slug}`);
      const original = path.join(root, "public", source);
      const originalBytes = await readFile(original);
      const { width: originalWidth, height: originalHeight } =
        await sharp(originalBytes).metadata();
      if (!originalWidth || !originalHeight)
        throw new Error(`Missing photo dimensions: ${source}`);
      const widths = [
        ...new Set(
          // 768w covers a ~372px mobile hero at DPR 1.75 or 2 without
          // jumping from 640w to 960w. Keep the established encoding quality.
          [160, 320, 640, 768, 960, 1280].map((width) =>
            Math.min(width, originalWidth),
          ),
        ),
      ];
      manifest[source] = widths;
      for (const width of widths) {
        const destination = original.slice(0, -4) + `-gallery-${width}.webp`;
        const existing = await existingFile(destination);
        if (existing && !rebuild) {
          // Retain committed bytes even when the installed encoder changes.
          // Refuse malformed/stale dimensions rather than silently replacing
          // an existing photo. Intentional source replacements need review.
          const variant = await sharp(await readFile(destination)).metadata();
          if (
            !existing.isFile() ||
            !existing.size ||
            variant.format !== "webp" ||
            variant.width !== width ||
            !variant.height ||
            Math.abs(variant.height - (originalHeight * width) / originalWidth) > 1
          ) {
            throw new Error(`Invalid existing gallery variant: ${destination}`);
          }
          retained += 1;
          continue;
        }
        const encoded = await sharp(originalBytes)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82, effort: 5 })
          .toBuffer();
        if (existing && encoded.equals(await readFile(destination))) {
          retained += 1;
          continue;
        }
        await writeFile(destination, encoded);
        written += 1;
      }
    }
  }
  // This generated frontend manifest prevents references to nonexistent variants,
  // including the gapped Beacon numbering and photos narrower than 1280 pixels.
  const manifestPath = path.join(root, "src/lib/model-gallery-assets.json");
  const serialized = JSON.stringify(manifest, null, 2) + "\n";
  const previous = (await existingFile(manifestPath))
    ? await readFile(manifestPath, "utf8")
    : null;
  const manifestUpdated = previous !== serialized;
  if (manifestUpdated) await writeFile(manifestPath, serialized);
  return { written, retained, sources: Object.keys(manifest).length, manifestUpdated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--rebuild"))
    throw new Error("Usage: node scripts/build-model-gallery-assets.mjs [--rebuild]");
  const { written, retained, sources } = await buildModelGalleryAssets(
    path.resolve(import.meta.dirname, ".."),
    { rebuild: args.includes("--rebuild") },
  );
  console.log(
    `Encoded ${written} gallery assets; retained ${retained} unchanged variants from ${sources} local JPEGs. Originals and catalog unchanged.`,
  );
}
