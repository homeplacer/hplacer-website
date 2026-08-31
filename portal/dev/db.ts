/**
 * Local database bootstrap shared by the dev server and the test suite.
 *
 * Node-only: it reads the migration files off disk. The Worker never imports
 * anything from `portal/dev`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { backfillMatchKeys } from "../src/domain/matching.ts";
import { SqliteDb } from "../src/platform/sqlite.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "migrations");
export const SEED_DIR = join(here, "..", "seed");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Applies every migration in order, recording them the way wrangler does. */
export async function applyMigrations(db: SqliteDb): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL UNIQUE,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,
  );

  const applied: string[] = [];
  for (const name of migrationFiles()) {
    const already = await db.prepare("SELECT name FROM d1_migrations WHERE name = ?").bind(name).first<{ name: string }>();
    if (already) continue;
    await db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
    await db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(name).run();
    applied.push(name);
  }
  return applied;
}

export async function applySeed(db: SqliteDb, file = "dev-seed.sql"): Promise<void> {
  await db.exec(readFileSync(join(SEED_DIR, file), "utf8"));
  // The seed carries addresses and phone numbers as text only; the normalized
  // matching keys are derived here by the same code the portal uses at runtime.
  await backfillMatchKeys(db);
}

export interface LocalDbOptions {
  path?: string;
  seed?: boolean;
}

export async function createLocalDb(options: LocalDbOptions = {}): Promise<SqliteDb> {
  const db = new SqliteDb(options.path ?? ":memory:");
  await applyMigrations(db);
  if (options.seed) await applySeed(db);
  return db;
}
