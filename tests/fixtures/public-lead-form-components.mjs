// Test-only module loader. No backend code or real intake helper is executed.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
export const formFiles = {
  financing: ["financing-form", "FinancingForm"],
  service: ["service-request-form", "ServiceRequestForm"],
  pricing: ["want-this-house-form", "WantThisHouseForm"],
  warranty: ["warranty-request-form", "WarrantyRequestForm"],
  careers: ["career-application-form", "CareerApplicationForm"],
};

export function loadForms(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const fixtureModule = { exports: {} };
    cache.set(filename, fixtureModule.exports);
    runInNewContext(output, {
      module: fixtureModule, exports: fixtureModule.exports,
      Error,
      FormData: overrides.FormData ?? FormData,
      fetch: overrides.fetch ?? (() => { throw new Error("Real network is forbidden in this fixture"); }),
      require: specifier => {
        if (specifier === "react") return overrides.react ?? require("react");
        if (specifier === "react/jsx-runtime") return require(specifier);
        if (specifier === "@/lib/lead") return { submitLead: overrides.submitLead ?? (() => { throw new Error("Real leads are forbidden"); }) };
        const base = specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : resolve(dirname(filename), specifier);
        const target = [base, `${base}.tsx`, `${base}.ts`, `${base}.json`].find(path => existsSync(path));
        if (!target) throw new Error(`Unexpected test dependency: ${specifier}`);
        return load(target);
      },
    });
    cache.set(filename, fixtureModule.exports);
    return fixtureModule.exports;
  }
  return Object.fromEntries(Object.entries(formFiles).map(([key, [file, name]]) => [
    key, load(resolve(`src/components/${file}.tsx`))[name],
  ]));
}

// Deterministic hook adapter for exercising real onSubmit code without a DOM.
// Actual React SSR and the browser fixture separately verify rendering/hydration.
export function createFormDriver(key, props = {}, hydrated = true) {
  const cells = [];
  const calls = [];
  const order = [];
  let cursor = 0;
  let settle;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = initial;
      return [cells[index], value => {
        cells[index] = value;
        if (value === "sending") order.push("sending");
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return cells[index] ??= { current: initial };
    },
    useId() { return `fixture-${cursor++}`; },
    useEffect() { cursor++; },
    useSyncExternalStore() { cursor++; return hydrated; },
  };
  class FixtureFormData extends FormData {
    constructor(form) {
      super();
      order.push("serialize");
      for (const [name, value] of form.entries) this.append(name, value);
    }
  }
  const pending = call => {
    calls.push(call);
    return new Promise((resolveResult, rejectResult) => { settle = { resolveResult, rejectResult }; });
  };
  const forms = loadForms({
    react, FormData: FixtureFormData,
    submitLead: (type, data) => pending({ type, data }),
    fetch: (url, options) => pending({ url, ...options }),
  });
  const form = { entries: [], resets: 0, reset() { this.resets++; } };
  let element;
  function render() { cursor = 0; element = forms[key](props); return element.props; }
  render();
  return {
    calls, order, form, render,
    submit() { return element.props.onSubmit({ currentTarget: form, preventDefault() {} }); },
    resolve(result) { settle.resolveResult(result); },
    reject(error = new Error("Synthetic failure")) { settle.rejectResult(error); },
  };
}
