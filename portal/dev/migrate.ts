/**
 * Applies the migrations (and optionally the demo seed) to a local SQLite file,
 * so a developer can keep a database between dev-server restarts.
 *
 *   node portal/dev/migrate.ts .wrangler/portal-local.sqlite --seed
 *
 * Against the real D1 database the equivalent is
 * `wrangler d1 migrations apply hplacer-portal --remote` from portal/.
 */
import { SqliteDb } from "../src/platform/sqlite.ts";
import { applyMigrations, applySeed } from "./db.ts";

const [pathArg, ...flags] = process.argv.slice(2);
const path = pathArg ?? ".wrangler/portal-local.sqlite";
const seed = flags.includes("--seed");

const db = new SqliteDb(path);
const applied = await applyMigrations(db);
console.log(applied.length === 0 ? `${path}: already up to date` : `${path}: applied ${applied.join(", ")}`);

if (seed) {
  await applySeed(db);
  console.log(`${path}: demo seed applied`);
}
db.close();
