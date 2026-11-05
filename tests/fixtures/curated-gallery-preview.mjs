// Isolated actual-component preview: loopback images only, no application layout,
// MLS fetch, analytics, form, or production API. Browser checks are manual/CUA.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.resolve(import.meta.dirname, "../..");
const bundled = await build({
  stdin: { contents: `export { CuratedGalleryImage } from './src/components/curated-gallery-image';
    export * from './src/lib/curated-gallery-images'; export * from './src/lib/gallery';`,
    resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"), external: ["react", "react/jsx-runtime"],
  logLevel: "silent",
});
const fixtureModule = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module: fixtureModule, exports: fixtureModule.exports, require: createRequire(import.meta.url),
});
export const galleryFixture = fixtureModule.exports;

export function renderGalleryImages(layout = "homepage", images) {
  const { CuratedGalleryImage, galleryByCategory, getGallery, homepageWorkImageSizes, galleryMasonryImageSizes } = galleryFixture;
  const items = images ?? (layout === "homepage"
    ? [...galleryByCategory("homes").slice(0, 4), ...galleryByCategory("development").slice(0, 2)]
    : getGallery());
  return renderToStaticMarkup(createElement("div", { className: layout }, items.map(image =>
    createElement(CuratedGalleryImage, { key: image.src, image,
      sizes: layout === "homepage" ? homepageWorkImageSizes : galleryMasonryImageSizes,
      pictureClassName: "photo",
      className: layout === "homepage" ? "work-image" : "masonry-image",
    }))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (/^\/gallery\/(?:home|dev)-\d{2}(?:-responsive-\d+)?\.(?:jpg|webp)$/.test(url.pathname)) {
      try {
        const bytes = await readFile(path.join(root, "public", url.pathname));
        response.writeHead(200, { "Content-Type": url.pathname.endsWith(".webp") ? "image/webp" : "image/jpeg", "Cache-Control": "no-store" });
        response.end(bytes);
      } catch {
        response.writeHead(404).end();
      }
      return;
    }
    if (url.pathname !== "/") { response.writeHead(404).end(); return; }
    const layout = url.searchParams.get("layout") === "masonry" ? "masonry" : "homepage";
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Curated gallery isolated preview</title><style>
      *{box-sizing:border-box}body{margin:0;font-family:system-ui}.container{width:100%;max-width:76rem;margin:auto;padding-inline:1.25rem}
      .homepage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.masonry{columns:1;gap:1rem}
      .photo{display:block}.masonry>.photo{margin-bottom:1rem;break-inside:avoid}img{display:block;width:100%;height:auto}
      .work-image{aspect-ratio:4/3;object-fit:cover}nav{padding-block:1rem}a{margin-right:1rem}
      @media(min-width:40rem){.homepage{grid-template-columns:repeat(3,minmax(0,1fr))}.masonry{columns:2}}
      @media(min-width:48rem){.container{padding-inline:2rem}}@media(min-width:64rem){.masonry{columns:3}}
      </style></head><body><main class="container"><nav><a href="/?layout=homepage">Homepage work grid</a><a href="/?layout=masonry">Gallery masonry</a></nav>
      ${renderGalleryImages(layout)}</main></body></html>`);
  });
  server.listen(18059, "127.0.0.1", () => console.log("Curated gallery preview: http://127.0.0.1:18059"));
}
