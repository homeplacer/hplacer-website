// Actual-component SSR with local photos/CSS only. No APIs, forms, analytics,
// browser scripts, or remote media. This is for manual/CUA layout review.
import { createServer } from "node:http";
import { readFile, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.resolve(import.meta.dirname, "../..");
export const publishedProjects = JSON.parse(readFileSync(path.join(root, "data/placed-homes.json"), "utf8"));
const clientComponents = new Map([
  ["home-card", "HomeCard"], ["home-gallery", "HomeGallery"], ["model-virtual-tour", "ModelVirtualTour"],
  ["home-inquiry-dialog", "HomeInquiryDialog"], ["want-this-house-form", "WantThisHouseForm"],
  ["width-selector", "WidthSelector"], ["width-context", "WidthProvider"], ["floor-plan-section", "FloorPlanSection"],
]);
const bundled = await build({
  stdin: { contents: `export { HistoricalProjectCard } from './src/components/historical-project-card';
    export * from './src/lib/historical-project-images';
    export * from './src/lib/homes';
    export { default as HomeDetailPage } from './src/app/homes/[slug]/page';
    export { default as PlacedDetailPage } from './src/app/recently-placed/[slug]/page';
    export { default as StoriesPage } from './src/app/stories/page';
    export { SoldExamples } from './src/components/sold-examples';`, resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"), external: ["react", "react/jsx-runtime"],
  logLevel: "silent", plugins: [{ name: "isolated-historical-projects", setup(builder) {
    builder.onResolve({ filter: /^(next\/(link|navigation)|@\/components\/[^/]+)$/ }, args => {
      const name = args.path.replace("@/components/", "");
      if (args.path.startsWith("next/") || clientComponents.has(name))
        return { path: args.path, namespace: "fixture" };
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
      let contents;
      if (args.path === "next/link") contents = `import {createElement} from 'react';
        export default function Link({href,children,...props}) {return createElement('a',{href,...props},children);}`;
      else if (args.path === "next/navigation") contents = `export function notFound(){throw new Error('Unknown fixture route');}`;
      else {
        const name = clientComponents.get(args.path.replace("@/components/", ""));
        contents = name === "WidthProvider"
          ? `export function WidthProvider({children}){return children;}`
          : `export function ${name}(){return null;}`;
      }
      return { contents, loader: "js" };
    });
  } }],
});
const fixtureModule = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module: fixtureModule, exports: fixtureModule.exports, require: createRequire(import.meta.url),
});
export const projectFixture = fixtureModule.exports;

function sectionAt(html, heading) {
  const position = html.indexOf(heading);
  if (position < 0) return "";
  return html.slice(html.lastIndexOf("<section", position), html.indexOf("</section>", position) + 10);
}
export function renderProjectCard(home, sizes = projectFixture.insetProjectImageSizes) {
  return renderToStaticMarkup(createElement(projectFixture.HistoricalProjectCard, { home, sizes }));
}
export async function renderModelProjects(slug = "stayin-alive") {
  const html = renderToStaticMarkup(await projectFixture.HomeDetailPage({ params: Promise.resolve({ slug }) }));
  return sectionAt(html, "Past ");
}
export async function renderRelatedProjects(slug = "3874-wayside-rd") {
  const html = renderToStaticMarkup(await projectFixture.PlacedDetailPage({ params: Promise.resolve({ slug }) }));
  return sectionAt(html, "More homes we");
}
export function renderStories() { return renderToStaticMarkup(createElement(projectFixture.StoriesPage)); }
export function renderHomepageProjects() { return renderToStaticMarkup(createElement(projectFixture.SoldExamples)); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cssFiles = readdirSync(path.join(root, ".next/static/chunks")).filter(file => file.endsWith(".css"));
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'");
    let file;
    if (/^\/recently-placed\/[a-z0-9-]+\/\d+(?:-sold-\d+)?\.(?:jpg|webp)$/.test(url.pathname))
      file = path.join(root, "public", url.pathname);
    else if (/^\/_next\/static\/(?:chunks|media)\/[a-zA-Z0-9._-]+\.(?:css|woff2)$/.test(url.pathname))
      file = path.join(root, ".next", url.pathname.slice("/_next/".length));
    if (file) {
      readFile(file, (error, bytes) => {
        if (error) { response.writeHead(404).end(); return; }
        response.writeHead(200, { "Content-Type": file.endsWith(".webp") ? "image/webp" : file.endsWith(".jpg") ? "image/jpeg" : file.endsWith(".css") ? "text/css" : "font/woff2" });
        response.end(bytes);
      });
      return;
    }
    try {
      let html;
      if (url.pathname === "/" || url.pathname === "/homes/stayin-alive") html = await renderModelProjects();
      else if (url.pathname === "/stories") html = renderStories();
      else if (url.pathname === "/homepage-projects") html = renderHomepageProjects();
      else if (/^\/homes\/[a-z0-9-]+$/.test(url.pathname)) html = await renderModelProjects(url.pathname.split("/").at(-1));
      else if (/^\/recently-placed\/[a-z0-9-]+$/.test(url.pathname)) html = await renderRelatedProjects(url.pathname.split("/").at(-1));
      else { response.writeHead(404).end("No API or submission route exists in this fixture."); return; }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Historical project card review</title>${cssFiles.map(file => `<link rel="stylesheet" href="/_next/static/chunks/${file}">`).join("")}
        <style>body{--font-geist-sans:system-ui;--font-fraunces:Georgia;margin:0}.fixture-nav{max-width:76rem;margin:auto;padding:1.25rem;display:flex;gap:1rem;flex-wrap:wrap}.fixture-nav a{text-decoration:underline}</style>
        </head><body><nav class="fixture-nav" aria-label="Fixture sections"><a href="/homes/stayin-alive">Model past projects</a><a href="/recently-placed/3874-wayside-rd">Related projects</a><a href="/stories">Town stories</a><a href="/homepage-projects">Homepage examples</a></nav>${html}</body></html>`);
    } catch { response.writeHead(404).end("Unknown fixture project."); }
  });
  const port = Number(process.env.PROJECT_CARD_FIXTURE_PORT || "18086");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid fixture port");
  server.listen(port, "127.0.0.1", () => console.log(`Historical project review: http://127.0.0.1:${port}/homes/stayin-alive`));
}
