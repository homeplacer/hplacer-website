/**
 * Minimal structural types for the Cloudflare bindings the portal uses.
 *
 * The portal deliberately does not depend on `@cloudflare/workers-types`: the
 * public marketing app does not need those types, and declaring only the
 * surface we actually call keeps the D1/R2 abstraction honest. A real
 * `D1Database` and `R2Bucket` satisfy these interfaces structurally.
 */

export interface DbMeta {
  changes?: number;
  last_row_id?: number;
  duration?: number;
}

export interface DbRunResult {
  success: boolean;
  meta: DbMeta;
}

export interface DbQueryResult<T> {
  results: T[];
  success: boolean;
  meta: DbMeta;
}

export interface DbPreparedStatement {
  bind(...values: unknown[]): DbPreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DbQueryResult<T>>;
  run(): Promise<DbRunResult>;
}

/** The subset of `D1Database` the portal relies on. */
export interface Db {
  prepare(sql: string): DbPreparedStatement;
  batch<T = Record<string, unknown>>(statements: DbPreparedStatement[]): Promise<DbQueryResult<T>[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
}

export interface ObjectPutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  sha256?: string;
}

export interface StoredObject {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  body?: ReadableStream | null;
  arrayBuffer?(): Promise<ArrayBuffer>;
}

/** The subset of `R2Bucket` the portal relies on. */
export interface ObjectStore {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream | null,
    options?: ObjectPutOptions,
  ): Promise<StoredObject | null>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

/**
 * Worker environment. Every value here is a binding or a non-secret setting.
 * No API tokens, Access service tokens, or Drive credentials are read here —
 * see portal/README.md for what a real deployment has to provision.
 */
export interface PortalEnv {
  PORTAL_DB: Db;
  PORTAL_PHOTOS?: ObjectStore;

  /** e.g. "homeplacer" for https://homeplacer.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag of the Access application. */
  ACCESS_AUD?: string;

  /**
   * "production" enforces Cloudflare Access. "development" permits the local
   * identity header used by `npm run portal:dev`; it is refused whenever the
   * request did not arrive over loopback.
   */
  PORTAL_ENVIRONMENT?: string;
  /** Local-only identity for `npm run portal:dev`, e.g. "greg@hplacer.com". */
  PORTAL_DEV_IDENTITY?: string;

  /**
   * Shared bearer token for the public warranty intake route, held by the
   * marketing Worker. A Worker *secret*, never a var, and never checked in.
   * Unset means the intake route is closed (503).
   */
  PORTAL_INTAKE_TOKEN?: string;
}
