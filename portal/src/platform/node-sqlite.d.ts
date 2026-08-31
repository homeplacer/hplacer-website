/**
 * Local typings for `node:sqlite`.
 *
 * The repo pins `@types/node@20`, which predates the module. Only the surface
 * used by the local D1 stand-in (portal/src/platform/sqlite.ts) is declared.
 */
declare module "node:sqlite" {
  export type SqliteValue = string | number | bigint | null | Uint8Array;

  export interface StatementRunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...params: SqliteValue[]): Record<string, unknown>[];
    get(...params: SqliteValue[]): Record<string, unknown> | undefined;
    run(...params: SqliteValue[]): StatementRunResult;
    setReadBigInts(enabled: boolean): void;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean });
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
