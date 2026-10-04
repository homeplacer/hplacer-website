import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyBuildCache } from "../scripts/verify-build-cache.mjs";

const script = fileURLToPath(new URL("../scripts/verify-build-cache.mjs", import.meta.url));
const sourcePath = ".open-next/cache";
const assetsPath = ".open-next/assets/cdn-cgi/_next_cache";
const validRecord = JSON.stringify({ type: "FETCH", value: { body: "fixture only" } });

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hplacer-build-cache-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, content = validRecord) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  const cli = (...args) => spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { root, write, cli };
}

test("valid nested route and extensionless fetch records pass without modifying artifacts", (t) => {
  const { root, write, cli } = fixture(t);
  const source = write(`${sourcePath}/build/route-cache/page.cache`);
  write(`${sourcePath}/__fetch/build/hash`);
  write(`${assetsPath}/build/route-cache/page.cache`);
  write(`${assetsPath}/__fetch/build/hash`);
  const before = { text: readFileSync(source, "utf8"), mtime: statSync(source).mtimeMs };
  const result = verifyBuildCache(root, { requireAssets: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.caches.map((cache) => cache.records), [2, 2]);
  assert.deepEqual(result.issues, []);
  assert.deepEqual({ text: readFileSync(source, "utf8"), mtime: statSync(source).mtimeMs }, before);
  const command = cli("--require-assets");
  assert.equal(command.status, 0);
  assert.match(command.stdout, /2 source records; 2 ASSETS mirror records/);
});

test("a valid build passes before OpenNext has populated its ASSETS mirror", (t) => {
  const { root, write, cli } = fixture(t);
  write(`${sourcePath}/__fetch/build/hash`);
  assert.equal(verifyBuildCache(root).ok, true);
  const command = cli();
  assert.equal(command.status, 0);
  assert.match(command.stdout, /ASSETS mirror not populated yet/);
});

test("post-population mode fails closed when its required mirror is absent", (t) => {
  const { root, write, cli } = fixture(t);
  write(`${sourcePath}/page.cache`);
  assert.equal(verifyBuildCache(root, { requireAssets: true }).ok, false);
  const command = cli("--require-assets");
  assert.equal(command.status, 1);
  assert.match(command.stderr, /_next_cache.*required cache directory is missing/);
});

test("missing source cache fails even if the mirror contains valid records", (t) => {
  const { root, write, cli } = fixture(t);
  write(`${assetsPath}/page.cache`);
  assert.equal(verifyBuildCache(root).ok, false);
  const command = cli();
  assert.equal(command.status, 1);
  assert.match(command.stderr, /\.open-next\/cache.*required cache directory is missing/);
});

test("empty source and present-but-empty mirror directories fail closed", (t) => {
  const { root, write } = fixture(t);
  mkdirSync(join(root, sourcePath), { recursive: true });
  assert.equal(verifyBuildCache(root).ok, false);
  write(`${sourcePath}/page.cache`);
  mkdirSync(join(root, assetsPath), { recursive: true });
  const result = verifyBuildCache(root);
  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /_next_cache.*has no records/);
});

test("malformed cache records fail without exposing response bodies or parser snippets", (t) => {
  const { root, write, cli } = fixture(t);
  const privateSentinel = "PRIVATE_CACHE_RESPONSE_SENTINEL";
  write(`${sourcePath}/__fetch/build/hash`, `{"body":"${privateSentinel}"`);
  const result = verifyBuildCache(root);
  assert.equal(result.ok, false);
  const command = cli();
  assert.equal(command.status, 1);
  assert.match(command.stderr, /cache record is not valid JSON/);
  assert.equal(`${command.stdout}${command.stderr}`.includes(privateSentinel), false);
  assert.equal(`${command.stdout}${command.stderr}`.includes("SyntaxError"), false);
});

test("concatenated JSON and corrupt duplicate tails are rejected rather than truncated", (t) => {
  const { root, write } = fixture(t);
  for (const content of [validRecord + validRecord, validRecord + '"duplicated-tail"}']) {
    const file = write(`${sourcePath}/__fetch/build/hash`, content);
    assert.equal(verifyBuildCache(root).ok, false);
    assert.equal(readFileSync(file, "utf8"), content);
  }
});

test("a corrupt existing ASSETS mirror fails even when the source is valid", (t) => {
  const { root, write, cli } = fixture(t);
  write(`${sourcePath}/page.cache`);
  write(`${assetsPath}/page.cache`, "not JSON");
  const result = verifyBuildCache(root);
  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /_next_cache\/page.cache.*not valid JSON/);
  assert.equal(cli().status, 1);
});

test("unexpected cache filenames are still validated", (t) => {
  const { root, write } = fixture(t);
  write(`${sourcePath}/page.cache`);
  write(`${sourcePath}/record.unexpected-extension`, "invalid");
  assert.equal(verifyBuildCache(root).ok, false);
});

test("non-directory roots and symlinked entries cannot silently bypass validation", (t) => {
  const { root, write } = fixture(t);
  write(sourcePath);
  assert.equal(verifyBuildCache(root).ok, false);
  rmSync(join(root, sourcePath));
  const record = write(`${sourcePath}/page.cache`);
  symlinkSync(record, join(root, sourcePath, "symlink.cache"));
  const result = verifyBuildCache(root);
  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /symlink.cache.*must be a regular file or directory/);
});

test("unsupported command-line arguments fail without echoing their contents", (t) => {
  const { cli } = fixture(t);
  const command = cli("PRIVATE_ARGUMENT_SENTINEL");
  assert.equal(command.status, 2);
  assert.match(command.stderr, /Usage:/);
  assert.equal(command.stderr.includes("PRIVATE_ARGUMENT_SENTINEL"), false);
});

test("the manual and scheduled deploy command checks cache integrity between build and upload", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["verify:build-cache"], "node scripts/verify-build-cache.mjs");
  assert.match(pkg.scripts.deploy, /opennextjs-cloudflare build && npm run verify:build-cache && opennextjs-cloudflare deploy$/);
});
