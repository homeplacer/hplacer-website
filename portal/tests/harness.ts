/** Shared setup for the portal test suite. */
import { handleRequest } from "../src/app.ts";
import type { AccessIdentity } from "../src/auth/access.ts";
import { loadActor } from "../src/auth/session.ts";
import type { Actor } from "../src/auth/authz.ts";
import { MemoryObjectStore } from "../src/platform/memory-store.ts";
import type { SqliteDb } from "../src/platform/sqlite.ts";
import type { PortalEnv } from "../src/platform/types.ts";
import { createLocalDb } from "../dev/db.ts";

export interface Harness {
  db: SqliteDb;
  store: MemoryObjectStore;
  env: PortalEnv;
  actor(email: string): Promise<Actor>;
  request(path: string, init?: RequestInit & { as?: string }): Promise<Response>;
  json<T = unknown>(path: string, init?: RequestInit & { as?: string }): Promise<T>;
  close(): void;
}

export function identityFor(email: string): AccessIdentity {
  return { subject: `dev|${email}`, email, method: "local_development" };
}

export async function createHarness(options: { seed?: boolean } = {}): Promise<Harness> {
  const db = await createLocalDb({ seed: options.seed ?? true });
  const store = new MemoryObjectStore();
  const env: PortalEnv = {
    PORTAL_DB: db,
    PORTAL_PHOTOS: store,
    PORTAL_ENVIRONMENT: "development",
    PORTAL_DEV_IDENTITY: "ops@hplacer.com",
  };

  async function request(path: string, init: RequestInit & { as?: string } = {}): Promise<Response> {
    const { as = "ops@hplacer.com", ...rest } = init;
    return handleRequest(new Request(`http://localhost:8788${path}`, rest), env, { identity: identityFor(as) });
  }

  const harness: Harness = {
    db,
    store,
    env,
    async actor(email: string) {
      return loadActor(db, identityFor(email));
    },
    request,
    async json<T>(path: string, init: RequestInit & { as?: string } = {}): Promise<T> {
      const headers = new Headers(init.headers);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      const response = await request(path, { ...init, headers });
      return (await response.json()) as T;
    },
    close() {
      db.close();
    },
  };
  return harness;
}

/** Body helper for the form posts the portal's own pages make. */
export function form(fields: Record<string, string | number | boolean | undefined>): RequestInit {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === false) continue;
    body.set(key, value === true ? "on" : String(value));
  }
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  };
}

export function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(value),
  };
}
