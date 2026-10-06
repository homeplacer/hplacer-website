// Manual, frontend-only derivatives of the current SoldExamples local JPEGs.
// Same originals and established encoder: no downloads, crops or enlargement.
// After intentionally replacing source pixels, run with --rebuild. Unknown or
// newly selected photos without generated assets keep their original fallback.
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function existingFile(file) {
  try { return await stat(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function buildSoldExampleAssets(root, { rebuild = false } = {}) {
  const homes = JSON.parse(await readFile(path.join(root, "data/placed-homes.json"), "utf8"));
  // Keep the component's live selection rule, not a fixed list of three photos.
  const selected = homes.filter((home) => home.photo && home.price > 0 && home.closeDate)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate)).slice(0, 3);
  const manifestPath = path.join(root, "src/lib/sold-example-assets.json");
  const previous = await existingFile(manifestPath) ? await readFile(manifestPath, "utf8") : null;
  const previousAssets = previous ? JSON.parse(previous) : {};
  const manifest = {};
  let written = 0;
  let retained = 0;
  for (const source of new Set(selected.map((home) => home.photo))) {
    // Never fetch remote photos or resolve user-controlled traversal paths.
    if (!/^\/recently-placed\/[a-z0-9-]+\/\d+\.jpg$/.test(source)) continue;
    const original = path.join(root, "public", source);
    const originalBytes = await readFile(original);
    const { width, height, orientation } = await sharp(originalBytes).metadata();
    if (!width || !height || (orientation && orientation !== 1))
      throw new Error(`Unsupported sold-example source dimensions/orientation: ${source}`);
    const sourceSha256 = hash(originalBytes);
    if (!rebuild && previousAssets[source] && previousAssets[source].sourceSha256 !== sourceSha256)
      throw new Error(`Changed sold-example source; run with --rebuild: ${source}`);
    // Include the source width so high-DPR screens retain its full resolution.
    const widths = [...new Set([320, 480, 640, 960].filter((value) => value < width).concat(width))];
    manifest[source] = { width, height, sourceSha256, widths };
    for (const candidate of widths) {
      const destination = original.slice(0, -4) + `-sold-${candidate}.webp`;
      const existing = await existingFile(destination);
      if (existing && !rebuild) {
        const variant = await sharp(await readFile(destination)).metadata();
        if (!existing.isFile() || !existing.size || variant.format !== "webp" ||
          variant.width !== candidate || !variant.height ||
          Math.abs(variant.height - height * candidate / width) > 1)
          throw new Error(`Invalid existing sold-example variant: ${destination}`);
        retained++;
        continue;
      }
      const encoded = await sharp(originalBytes)
        .resize({ width: candidate, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 }).toBuffer();
      if (existing && encoded.equals(await readFile(destination))) { retained++; continue; }
      await writeFile(destination, encoded);
      written++;
    }
  }
  const serialized = JSON.stringify(manifest, null, 2) + "\n";
  const manifestUpdated = previous !== serialized;
  if (manifestUpdated) await writeFile(manifestPath, serialized);
  return { written, retained, sources: Object.keys(manifest).length, manifestUpdated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--rebuild"))
    throw new Error("Usage: node scripts/build-sold-example-assets.mjs [--rebuild]");
  console.log(JSON.stringify(await buildSoldExampleAssets(path.resolve(import.meta.dirname, ".."), {
    rebuild: args.includes("--rebuild"),
  })));
}
