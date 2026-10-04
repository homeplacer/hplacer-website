// Repeatable frontend asset encoding only: no retouching, source-catalog edits,
// remote downloads, image service, or runtime/backend dependency.
// Prerequisite: npm ci installs the repository's currently locked Next/sharp
// dependency tree. Normal builds use committed assets without running encoding.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const models = JSON.parse(
  await readFile(path.join(root, "data/models.json"), "utf8"),
);
const manifest = {};
let written = 0;
for (const model of models) {
  for (const source of model.imageUrls) {
    if (!source.startsWith("/models/")) continue;
    if (!new RegExp(`^/models/${model.slug}/\\d{2}\\.jpg$`).test(source))
      throw new Error(`Unexpected local gallery source for ${model.slug}`);
    const original = path.join(root, "public", source);
    const { width: originalWidth } = await sharp(original).metadata();
    if (!originalWidth) throw new Error(`Missing photo dimensions: ${source}`);
    const widths = [
      ...new Set(
        [160, 320, 640, 960, 1280].map((width) =>
          Math.min(width, originalWidth),
        ),
      ),
    ];
    manifest[source] = widths;
    for (const width of widths) {
      const destination = original.slice(0, -4) + `-gallery-${width}.webp`;
      await sharp(original)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(destination);
      written += 1;
    }
  }
}
// This generated frontend manifest prevents references to nonexistent variants,
// including the gapped Beacon numbering and photos narrower than 1280 pixels.
await writeFile(
  path.join(root, "src/lib/model-gallery-assets.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Encoded ${written} gallery assets from existing local JPEGs; originals and catalog unchanged.`,
);
