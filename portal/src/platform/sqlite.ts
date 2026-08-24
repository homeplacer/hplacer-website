/**
 * A `Db` implementation backed by `node:sqlite`.
 *
 * This is the local stand-in for D1 used by `npm run portal:dev` and the test
 * suite. It never runs inside the Worker — nothing under `src/api`, `src/ui`,
 * or `src/worker.ts` imports it — so the deployed bundle stays free of Node
 * built-ins. D1 speaks the same SQLite dialect, so the migrations exercised
 * here are the migrations that get applied to D1.
 */
import { DatabaseSync, type StatementSync, type SqliteValue } from "node:sqlite";
import type { Db, DbPreparedStatement, DbQueryResult, DbRunResult } from "./types.ts";

function toSqliteValue(value: unknown): SqliteValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  // D1 rejects objects too; serialising here would hide a bug.
  throw new TypeError(`Unsupported SQL parameter of type ${typeof value}`);
}

class SqliteStatement implements DbPreparedStatement {
  readonly #statement: StatementSync;
  readonly #params: SqliteValue[];

  constructor(statement: StatementSync, params: SqliteValue[] = []) {
    this.#statement = statement;
    this.#params = params;
  }

  bind(...values: unknown[]): DbPreparedStatement {
    return new SqliteStatement(this.#statement, values.map(toSqliteValue));
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.#statement.get(...this.#params);
    return (row ?? null) as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<DbQueryResult<T>> {
    const rows = this.#statement.all(...this.#params) as T[];
    return { results: rows, success: true, meta: { changes: 0 } };
  }

  async run(): Promise<DbRunResult> {
    const result = this.#statement.run(...this.#params);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }

  runSync(): DbRunResult {
    const result = this.#statement.run(...this.#params);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

export class SqliteDb implements Db {
  readonly #database: DatabaseSync;

  constructor(path = ":memory:") {
    this.#database = new DatabaseSync(path);
    this.#database.exec("PRAGMA foreign_keys = ON;");
  }

  prepare(sql: string): DbPreparedStatement {
    return new SqliteStatement(this.#database.prepare(sql));
  }

  /**
   * D1 runs a batch inside one implicit transaction and rolls the whole thing
   * back on failure. Mirror that so code written against `batch()` behaves the
   * same locally and in production.
   */
  async batch<T = Record<string, unknown>>(statements: DbPreparedStatement[]): Promise<DbQueryResult<T>[]> {
    this.#database.exec("BEGIN");
    try {
      const out: DbQueryResult<T>[] = [];
      for (const statement of statements) {
        const result = (statement as SqliteStatement).runSync();
        out.push({ results: [], success: true, meta: result.meta });
      }
      this.#database.exec("COMMIT");
      return out;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.#database.exec(sql);
    return { count: 0, duration: 0 };
  }

  close(): void {
    this.#database.close();
  }
}
