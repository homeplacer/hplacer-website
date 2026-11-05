// Actual-component SSR preview with loopback assets only. No app layout, feed,
// analytics, lead form or external requests. Browser checks are manual/CUA.
import { createServer } from "node:http";
import { readFile, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.resolve(import.meta.dirname, "../..");
const homes = JSON.parse(readFileSync(path.join(root, "data/placed-homes.json"), "utf8"));
const fixtureData = { homes };
const bundled = await build({
  stdin: { contents: `export { SoldExamples } from './src/components/sold-examples';
    export * from './src/lib/sold-example-images';`, resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"), external: ["react", "react/jsx-runtime"],
  logLevel: "silent", plugins: [{ name: "isolated-sold-examples", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|@\/lib\/placed-homes)$/ }, args =>
      ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
      contents: args.path === "next/link"
        ? `import {createElement} from 'react'; export default function Link({href,children,...props}) {
          return createElement('a',{href,...props},children); }`
        : "export const getAllPlacedHomes = () => fixtureData.homes;",
      loader: "js",
    }));
  } }],
});
const fixtureModule = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module: fixtureModule, exports: fixtureModule.exports,
  require: createRequire(import.meta.url), fixtureData,
});
export const soldFixture = fixtureModule.exports;
export function renderSoldExamples(items = homes) {
  fixtureData.homes = items;
  return renderToStaticMarkup(createElement(soldFixture.SoldExamples));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (/^\/recently-placed\/[a-z0-9-]+\/\d+(?:-sold-\d+)?\.(?:jpg|webp)$/.test(url.pathname)) {
      readFile(path.join(root, "public", url.pathname), (error, bytes) => {
        if (error) { response.writeHead(404).end(); return; }
        response.writeHead(200, { "Content-Type": url.pathname.endsWith(".webp") ? "image/webp" : "image/jpeg", "Cache-Control": "no-store" });
        response.end(bytes);
      });
      return;
    }
    if (url.pathname !== "/") { response.writeHead(404).end(); return; }
    const original = url.searchParams.get("original") === "1";
    const html = renderSoldExamples();
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>SoldExamples isolated preview</title><style>
      *{box-sizing:border-box}body{margin:0;font-family:system-ui;color:#131a26}.container-x{width:100%;max-width:76rem;margin:auto;padding:1.25rem}
      .grid{display:grid;grid-template-columns:1fr;gap:1.5rem}.grid>a{display:block;overflow:hidden;border:1px solid #e3e8ef;border-radius:1rem;color:inherit;text-decoration:none}
      picture{display:block}img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}.p-5{padding:1.25rem}.mt-9{margin-top:2.25rem}
      @media(min-width:40rem){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:48rem){.container-x{padding-inline:2rem}}
      </style></head><body>${original ? html.replace(/<source\b[^>]*>/g, "") : html}</body></html>`);
  });
  server.listen(18065, "127.0.0.1", () => console.log("SoldExamples preview: http://127.0.0.1:18065 (original JPEG comparison: /?original=1)"));
}
