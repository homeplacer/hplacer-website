import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_CACHE = ".open-next/cache";
const ASSETS_CACHE = ".open-next/assets/cdn-cgi/_next_cache";

// Validate the serialized outer records, not cached response bodies or a
// version-specific OpenNext schema. Never modify artifacts or log their data.
export function verifyBuildCache(projectRoot, { requireAssets = false } = {}) {
  const root = resolve(projectRoot);
  const issues = [];
  const caches = [];
  const report = (path, reason) => {
    issues.push(`${JSON.stringify(relative(root, path))}: ${reason}`);
  };

  for (const [cachePath, required] of [
    [SOURCE_CACHE, true],
    [ASSETS_CACHE, requireAssets],
  ]) {
    const directory = join(root, cachePath);
    const cache = { path: cachePath, present: false, records: 0 };
    caches.push(cache);
    let stats;
    try {
      stats = lstatSync(directory);
    } catch (error) {
      if (error.code === "ENOENT") {
        if (required) report(directory, "required cache directory is missing");
      } else {
        report(directory, "cache directory cannot be inspected");
      }
      continue;
    }
    cache.present = true;
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      report(directory, "cache root must be a real directory");
      continue;
    }

    const walk = (path) => {
      let entries;
      try {
        entries = readdirSync(path, { withFileTypes: true });
      } catch {
        report(path, "cache directory cannot be read");
        return;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const recordPath = join(path, entry.name);
        if (entry.isDirectory()) {
          walk(recordPath);
          continue;
        }
        if (!entry.isFile()) {
          report(recordPath, "cache entry must be a regular file or directory");
          continue;
        }
        // Fetch-cache records have no extension; route records use .cache.
        // Checking all files also catches corrupt records with unexpected names.
        cache.records += 1;
        let text;
        try {
          text = readFileSync(recordPath, "utf8");
        } catch {
          report(recordPath, "cache record cannot be read");
          continue;
        }
        try {
          JSON.parse(text);
        } catch {
          // JSON.parse errors can include response data: never emit the error.
          report(recordPath, "cache record is not valid JSON");
        }
      }
    };
    walk(directory);
    if (cache.records === 0) report(directory, "cache directory has no records");
  }
  return { ok: issues.length === 0, issues, caches };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--require-assets")) {
    console.error("Usage: node scripts/verify-build-cache.mjs [--require-assets]");
    process.exitCode = 2;
    return;
  }
  const result = verifyBuildCache(process.cwd(), {
    requireAssets: args.includes("--require-assets"),
  });
  if (!result.ok) {
    console.error("Build cache integrity check failed. Deployment must stop.");
    for (const issue of result.issues) console.error(`- ${issue}`);
    console.error(
      "Rebuild in an exclusive checkout and rerun the check; do not truncate or repair cache records by hand.",
    );
    process.exitCode = 1;
    return;
  }
  const [source, assets] = result.caches;
  console.log(
    `Build cache integrity verified: ${source.records} source records; ` +
      (assets.present
        ? `${assets.records} ASSETS mirror records.`
        : "No ASSETS mirror (R2 deployments populate the validated source records into R2)."),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
