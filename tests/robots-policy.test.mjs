import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTs(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    Response,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

const policy = loadTs("src/lib/robots-policy.ts");
const route = loadTs("src/app/robots.txt/route.ts", {
  "@/lib/robots-policy": policy,
});

// Pin the pre-change policy independently of the production exports. Any new
// crawler, private path, ordering, or output-byte change needs a separate review.
const originalPrivatePaths = [
  "/api/",
  "/portal",
  "/employee",
  "/admin",
  "/uploads/",
  "/private/",
];
const originalRetrievalBots = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];
const originalTrainingBots = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
];
const privateRules = originalPrivatePaths.map((path) => `Disallow: ${path}\n`).join("");
const originalText =
  "# Public search and assistant retrieval allowed; model training disallowed.\n" +
  "User-agent: *\n" +
  "Content-Signal: search=yes, ai-input=yes, ai-train=no\n" +
  "Allow: /\n" +
  privateRules +
  "\n" +
  originalRetrievalBots
    .map((bot) => `User-agent: ${bot}\nAllow: /\n${privateRules}\n`)
    .join("") +
  originalTrainingBots.map((bot) => `User-agent: ${bot}\nDisallow: /\n\n`).join("") +
  "Sitemap: https://hplacer.com/sitemap.xml\n";

test("robots change comments the nonstandard directive and preserves every other output byte", () => {
  const text = policy.robotsText();
  assert.equal(text, originalText.replace("\nContent-Signal:", "\n# Content-Signal:"));
  assert.deepEqual(Array.from(policy.privatePaths), originalPrivatePaths);
  assert.deepEqual(Array.from(policy.retrievalBots), originalRetrievalBots);
  assert.deepEqual(Array.from(policy.trainingBots), originalTrainingBots);
});

test("only Google-supported fields are emitted as active robots directives", () => {
  const text = policy.robotsText();
  assert.doesNotMatch(text, /^\s*Content-Signal\s*:/im);
  assert.match(text, /^# Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  const supportedFields = new Set(["user-agent", "allow", "disallow", "sitemap"]);
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    assert.ok(supportedFields.has(line.split(":", 1)[0].trim().toLowerCase()), line);
  }
});

test("public retrieval keeps every private exclusion and training blocks stay explicit", () => {
  const text = policy.robotsText();
  for (const bot of ["*", ...originalRetrievalBots]) {
    const block = text.split(`User-agent: ${bot}\n`)[1].split("\n\n")[0];
    assert.match(block, /^Allow: \/$/m, bot);
    for (const path of originalPrivatePaths) {
      assert.ok(block.includes(`Disallow: ${path}\n`) || block.endsWith(`Disallow: ${path}`), `${bot}: ${path}`);
    }
  }
  for (const bot of originalTrainingBots) {
    assert.ok(text.includes(`User-agent: ${bot}\nDisallow: /\n\n`), bot);
  }
});

test("robots handler remains a static plain-text GET with the exact policy body", async () => {
  assert.equal(route.dynamic, "force-static");
  const response = route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), policy.robotsText());
  assert.deepEqual(Object.keys(route).sort(), ["GET", "dynamic"]);
});
