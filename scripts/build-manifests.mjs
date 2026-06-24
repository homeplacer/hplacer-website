// Generates bundled JSON manifests of the image files under public/, so the
// data loaders can use static imports instead of runtime fs.readdirSync — the
// Cloudflare Workers runtime has no readable filesystem at request time.
// Wired into the build/deploy/preview scripts; safe to run anytime.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isImg = (f) => /\.(jpe?g|png)$/i.test(f);
const listImgs = (dir) => {
  try {
    return fs.readdirSync(dir).filter(isImg).sort();
  } catch {
    return [];
  }
};

// Gallery: flat list of image filenames.
const gallery = listImgs(path.join(root, "public", "gallery"));

// Locations: { slug: [filenames] }
const locDir = path.join(root, "public", "locations");
const locations = {};
try {
  for (const slug of fs.readdirSync(locDir)) {
    const full = path.join(locDir, slug);
    if (fs.statSync(full).isDirectory()) locations[slug] = listImgs(full);
  }
} catch {
  /* no locations dir — leave empty */
}

const dataDir = path.join(root, "data");
fs.writeFileSync(
  path.join(dataDir, "gallery-manifest.json"),
  JSON.stringify(gallery, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(dataDir, "locations-manifest.json"),
  JSON.stringify(locations, null, 2) + "\n",
);
console.log(
  `[manifests] gallery: ${gallery.length} images; locations: ${Object.keys(locations).length} towns`,
);
