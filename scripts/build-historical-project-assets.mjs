// Deterministic derivatives of existing public sold-project photos only.
// No new photos, cropping, source records, publication scope or downloads.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProjectPhotoAssets } from "./build-sold-example-assets.mjs";

export async function buildHistoricalProjectAssets(root, options = {}) {
  const homes = JSON.parse(await readFile(path.join(root, "data/placed-homes.json"), "utf8"));
  return buildProjectPhotoAssets(root, homes.map(home => home.photo), {
    ...options, manifest: "historical-project-assets.json",
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rebuild"))
    throw new Error("Usage: node scripts/build-historical-project-assets.mjs [--rebuild]");
  console.log(JSON.stringify(await buildHistoricalProjectAssets(path.resolve(import.meta.dirname, ".."), {
    rebuild: args.includes("--rebuild"),
  })));
}
