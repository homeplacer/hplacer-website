// Isolated actual-React browser fixture. All requests resolve in memory only.
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { build } from "esbuild";
import { loadForms, formFiles } from "./public-lead-form-components.mjs";

const forms = loadForms();
const propsFor = (key, assistance) => key === "pricing"
  ? { model: "Fixture Model", address: "123 Synthetic Lane" }
  : key === "financing" && assistance
    ? { compact: true, requireEmail: true, submitLabel: "Send me assistance details", successTitle: "Thanks — we'll be in touch." }
    : {};

async function startPreview() {
  const browserBundle = await build({
    absWorkingDir: process.cwd(), bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic", logLevel: "silent",
    plugins: [{
      name: "fake-intake",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/lead$/ }, () => ({ path: "lead", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const submitLead = (type, data) => window.fixtureSubmit(type, data);", loader: "js" }));
      },
    }],
    stdin: {
      resolveDir: process.cwd(), sourcefile: "public-form-fixture.jsx",
      contents: `
        import { createElement } from "react";
        import { hydrateRoot } from "react-dom/client";
        ${Object.entries(formFiles).map(([, [file, name]]) => `import { ${name} } from "./src/components/${file}";`).join("\n")}
        const forms = { ${Object.entries(formFiles).map(([key, [, name]]) => `${key}: ${name}`).join(", ")} };
        const query = new URLSearchParams(location.search);
        const key = query.get("form") || "financing";
        const props = key === "pricing" ? { model: "Fixture Model", address: "123 Synthetic Lane" }
          : key === "financing" && query.get("assistance") === "1" ? { compact: true, requireEmail: true, submitLabel: "Send me assistance details", successTitle: "Thanks — we'll be in touch." } : {};
        const requests = [];
        let settle;
        let requestKind;
        function inspect() {
          const root = document.getElementById("root");
          document.getElementById("diagnostics").textContent = JSON.stringify({
            forms: root.querySelectorAll("form").length,
            regions: root.querySelectorAll("[data-form-region]").length,
            fieldsDisabled: root.querySelector("fieldset")?.disabled ?? null,
            status: root.querySelector('[role="status"]').textContent,
            error: root.querySelector('[role="alert"]').textContent,
            focus: document.activeElement?.tagName + ": " + (document.activeElement?.textContent || ""),
            requests
          }, null, 2);
        }
        function pending(call, kind) {
          requests.push(call); requestKind = kind; inspect();
          return new Promise((resolve, reject) => { settle = { resolve, reject }; });
        }
        window.fixtureSubmit = (type, data) => pending({ type, data }, "lead");
        window.fetch = (url, options) => pending({
          url, method: options.method,
          entries: [...options.body.entries()].map(([name, value]) => [name, value instanceof File ? { name: value.name, size: value.size, type: value.type } : value])
        }, "multipart");
        document.getElementById("hydrate").addEventListener("click", event => {
          event.currentTarget.disabled = true;
          hydrateRoot(document.getElementById("root"), createElement(forms[key], props));
        });
        for (const result of ["api", "error", "mailto"]) {
          document.getElementById(result).addEventListener("click", () => {
            settle?.resolve(requestKind === "lead" ? result : {
              ok: result === "api", status: result === "api" ? 200 : 422,
              json: async () => result === "api" ? { ok: true, reference: "fixture-reference" } : { error: "Synthetic validation rejection" }
            });
            settle = undefined;
          });
        }
        document.getElementById("reject").addEventListener("click", () => { settle?.reject(new Error("Synthetic request failure")); settle = undefined; });
        document.getElementById("double").addEventListener("click", () => {
          const form = document.querySelector("#root form"); form?.requestSubmit(); form?.requestSubmit();
        });
        new MutationObserver(inspect).observe(document.getElementById("root"), { subtree: true, childList: true, characterData: true, attributes: true });
        document.addEventListener("focusin", inspect); inspect();
      `,
    },
  });
  createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/fixture.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(browserBundle.outputFiles[0].contents); return;
    }
    const key = url.searchParams.get("form") || "financing";
    if (url.pathname !== "/" || !(key in forms)) {
      response.writeHead(404).end("No real API exists in this fixture."); return;
    }
    const noJs = url.searchParams.get("mode") === "no-js";
    const html = renderToString(React.createElement(forms[key], propsFor(key, url.searchParams.get("assistance") === "1")));
    response.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; script-src ${noJs ? "'none'" : "'self'"}; connect-src 'none'; form-action 'none'; base-uri 'none'`);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated public lead form fixture</title><style>
      body { font: 16px system-ui; max-width: 720px; margin: 24px auto; padding: 16px; }
      input:not([type=checkbox]), textarea, select { display: block; width: 90%; margin: 4px 0 12px; padding: 8px; }
      fieldset { border: 0; padding: 0; } button, a { margin: 4px 12px 4px 0; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      #diagnostics { white-space: pre-wrap; background: #eee; padding: 12px; }
    </style></head><body><h1>Isolated ${key}: ${noJs ? "no JavaScript" : "delayed hydration"}</h1>
    <p>Synthetic data only. No real API, tracking, mail app, or production connection.</p>
    <nav>${Object.keys(forms).map(name => `<a href="/?form=${name}">${name}</a>`).join(" ")}<a href="/?form=financing&amp;assistance=1">Assistance</a><a href="/?form=${key}&amp;mode=no-js">No JavaScript</a></nav>
    ${noJs ? "" : '<div><button id="hydrate">Hydrate form</button><button id="api">Resolve confirmed success</button><button id="error">Resolve error</button><button id="mailto">Resolve mailto (lead helper only)</button><button id="reject">Reject pending request</button><button id="double">Double-submit test</button></div>'}
    <hr><div id="root">${html}</div><hr><pre id="diagnostics">Server snapshot: zero native forms; fields disabled; zero requests.</pre>
    ${noJs ? "" : '<script src="/fixture.js"></script>'}</body></html>`);
  }).listen(18057, "127.0.0.1", () => console.log("Isolated five-form fixture: http://127.0.0.1:18057/"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startPreview();
