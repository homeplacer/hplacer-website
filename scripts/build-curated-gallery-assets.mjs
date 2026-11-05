// Frontend-only derivatives of the reviewed public/gallery originals. No crops,
// retouching, remote downloads, runtime image service, or automatic build step.
// npm ci provides the existing locked Next/sharp encoder. Incremental runs retain
// committed bytes; after intentionally replacing source pixels/settings, use:
// node scripts/build-curated-gallery-assets.mjs --rebuild
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

export async function buildCuratedGalleryAssets(root, { rebuild = false } = {}) {
  const files = JSON.parse(await readFile(path.join(root, "data/gallery-manifest.json"), "utf8"));
  const manifest = {};
  let written = 0;
  let retained = 0;
  for (const file of files) {
    if (!/^(home|dev)-\d{2}\.jpg$/.test(file))
      throw new Error(`Unexpected curated gallery source: ${file}`);
    const source = `/gallery/${file}`;
    const original = path.join(root, "public", source);
    const originalBytes = await readFile(original);
    const { width: originalWidth, height: originalHeight } = await sharp(originalBytes).metadata();
    if (!originalWidth || !originalHeight) throw new Error(`Missing photo dimensions: ${source}`);
    // The existing full-size WebP remains the largest candidate and is never
    // rewritten. Verify its identity dimensions before advertising that width.
    const fullSize = original.slice(0, -4) + ".webp";
    const full = await sharp(await readFile(fullSize)).metadata();
    if (full.format !== "webp" || full.width !== originalWidth || full.height !== originalHeight)
      throw new Error(`Invalid full-size curated WebP: ${fullSize}`);
    const widths = [320, 480, 640, 768, 1200].filter((width) => width < originalWidth);
    manifest[source] = { width: originalWidth, widths };
    for (const width of widths) {
      const destination = original.slice(0, -4) + `-responsive-${width}.webp`;
      const existing = await existingFile(destination);
      if (existing && !rebuild) {
        const variant = await sharp(await readFile(destination)).metadata();
        if (!existing.isFile() || !existing.size || variant.format !== "webp" ||
          variant.width !== width || !variant.height ||
          Math.abs(variant.height - originalHeight * width / originalWidth) > 1)
          throw new Error(`Invalid existing curated variant: ${destination}`);
        retained++;
        continue;
      }
      const encoded = await sharp(originalBytes)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toBuffer();
      if (existing && encoded.equals(await readFile(destination))) {
        retained++;
        continue;
      }
      await writeFile(destination, encoded);
      written++;
    }
  }
  const manifestPath = path.join(root, "src/lib/curated-gallery-assets.json");
  const serialized = JSON.stringify(manifest, null, 2) + "\n";
  const previous = (await existingFile(manifestPath)) ? await readFile(manifestPath, "utf8") : null;
  const manifestUpdated = previous !== serialized;
  if (manifestUpdated) await writeFile(manifestPath, serialized);
  return { written, retained, sources: Object.keys(manifest).length, manifestUpdated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--rebuild"))
    throw new Error("Usage: node scripts/build-curated-gallery-assets.mjs [--rebuild]");
  const result = await buildCuratedGalleryAssets(path.resolve(import.meta.dirname, ".."), {
    rebuild: args.includes("--rebuild"),
  });
  console.log(JSON.stringify(result));
}
