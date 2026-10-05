// Isolated loopback fixture: real React + ContactForm, fake lead results only.
// Run with node tests/fixtures/contact-form-preview.mjs; never serves the API.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const require = createRequire(import.meta.url);
const filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(filename), "../..");
export const fixtureProps = { defaultHome: "Fixture Home", packageId: "fixture-package" };
const fakeLead = {
  name: "fake-contact-lead",
  setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/lead$/ }, () => ({ path: "lead", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: "export const submitLead = (type, data) => window.fixtureSubmit(type, data);",
      loader: "js",
    }));
  },
};
const sharedBuild = {
  absWorkingDir: projectRoot,
  bundle: true,
  write: false,
  plugins: [fakeLead],
  jsx: "automatic",
  logLevel: "silent",
};
const serverBundle = await build({
  ...sharedBuild,
  entryPoints: ["src/components/contact-form.tsx"],
  platform: "node",
  format: "cjs",
  external: ["react", "react/*"],
});
const fixtureModule = { exports: {} };
runInNewContext(serverBundle.outputFiles[0].text, {
  module: fixtureModule,
  exports: fixtureModule.exports,
  require,
});
export function renderFixture(props = fixtureProps) {
  return renderToString(createElement(fixtureModule.exports.ContactForm, props));
}
export function renderFixtureGroup() {
  return renderToString(createElement("div", null,
    createElement(fixtureModule.exports.ContactForm, fixtureProps),
    createElement(fixtureModule.exports.ContactForm, fixtureProps),
  ));
}

async function startPreview() {
  const browserBundle = await build({
    ...sharedBuild,
    platform: "browser",
    format: "iife",
    stdin: {
      resolveDir: projectRoot,
      sourcefile: "contact-fixture-entry.jsx",
      contents: `
        import { createElement } from "react";
        import { hydrateRoot } from "react-dom/client";
        import { ContactForm } from "./src/components/contact-form";
        const requests = [];
        let finish;
        function inspect() {
          const root = document.getElementById("root");
          document.getElementById("diagnostics").textContent = JSON.stringify({
            forms: root.querySelectorAll("form").length,
            fieldsDisabled: root.querySelector("fieldset")?.disabled ?? null,
            sendDisabled: root.querySelector("button")?.disabled ?? null,
            status: root.querySelector('[role="status"]').textContent,
            error: root.querySelector('[role="alert"]').textContent,
            focus: document.activeElement?.tagName + ": " + (document.activeElement?.textContent || ""),
            requests
          }, null, 2);
        }
        window.fixtureSubmit = (type, data) => {
          requests.push({ type, data });
          inspect();
          return new Promise(resolve => { finish = resolve; });
        };
        document.getElementById("hydrate").addEventListener("click", event => {
          event.currentTarget.disabled = true;
          hydrateRoot(document.getElementById("root"), createElement(ContactForm, ${JSON.stringify(fixtureProps)}));
        });
        for (const result of ["api", "error", "mailto"]) {
          document.getElementById(result).addEventListener("click", () => {
            finish?.(result);
            finish = undefined;
          });
        }
        document.getElementById("double").addEventListener("click", () => {
          const form = document.querySelector("#root form");
          form?.requestSubmit();
          form?.requestSubmit();
        });
        new MutationObserver(inspect).observe(document.getElementById("root"), {
          subtree: true, childList: true, characterData: true, attributes: true
        });
        document.addEventListener("focusin", inspect);
        inspect();
      `,
    },
  });
  const html = renderFixture();
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/fixture.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(browserBundle.outputFiles[0].contents);
      return;
    }
    if (url.pathname !== "/") {
      response.writeHead(404).end("No API or submission route exists in this fixture.");
      return;
    }
    const noJs = url.searchParams.get("mode") === "no-js";
    // Network and native submission are blocked even if a future regression occurs.
    response.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; script-src ${noJs ? "'none'" : "'self'"}; connect-src 'none'; form-action 'none'; base-uri 'none'`);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated contact form fixture</title><style>
      body { font: 16px system-ui; max-width: 720px; margin: 24px auto; padding: 16px; }
      input, textarea { display: block; width: 90%; margin: 4px 0 12px; padding: 8px; }
      fieldset { border: 0; padding: 0; } button, a { margin-right: 12px; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      #diagnostics { white-space: pre-wrap; background: #eee; padding: 12px; }
    </style></head><body><h1>Isolated contact form: ${noJs ? "no JavaScript" : "delayed hydration"}</h1>
    <p>Synthetic data only. No real API, tracking, mail app, or production connection.</p>
    ${noJs ? "" : '<div><button id="hydrate">Hydrate form</button><button id="api">Return API success</button><button id="error">Return API error</button><button id="mailto">Return mailto fallback</button><button id="double">Double-submit test</button></div>'}
    <hr><div id="root">${html}</div><hr><pre id="diagnostics">Server snapshot: no native form; fields disabled; zero lead requests.</pre>
    ${noJs ? "" : '<script src="/fixture.js"></script>'}</body></html>`);
  });
  server.listen(18055, "127.0.0.1", () => {
    console.log("Isolated fixture: http://127.0.0.1:18055/ and /?mode=no-js");
  });
}

if (process.argv[1] && resolve(process.argv[1]) === filename) await startPreview();
