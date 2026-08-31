/**
 * Local development host.
 *
 * Bridges Node's HTTP server to the Worker's `fetch` handler, backed by
 * `node:sqlite` in place of D1 and an in-memory bucket in place of R2. This is
 * a developer convenience only; it binds to loopback, and the Worker refuses
 * the development identity for any request that did not arrive over loopback.
 *
 *   npm run portal:dev                    # signs in as greg@hplacer.com
 *   PORTAL_DEV_IDENTITY=tara@hplacer.com npm run portal:dev
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { handleRequest } from "../src/app.ts";
import { MemoryObjectStore } from "../src/platform/memory-store.ts";
import type { PortalEnv } from "../src/platform/types.ts";
import { createLocalDb } from "./db.ts";

const PORT = Number(process.env.PORT ?? 8788);
const HOST = "127.0.0.1";
const DEV_IDENTITY = process.env.PORTAL_DEV_IDENTITY ?? "greg@hplacer.com";
const DB_PATH = process.env.PORTAL_DB_PATH ?? ":memory:";
// Local-only stand-in for the shared intake token so the public warranty flow
// is exercisable end to end without provisioning anything. Loopback only.
const INTAKE_TOKEN = process.env.PORTAL_INTAKE_TOKEN ?? "dev-intake-token";

const db = await createLocalDb({ path: DB_PATH, seed: process.env.PORTAL_SEED !== "0" });
const env: PortalEnv = {
  PORTAL_DB: db,
  PORTAL_PHOTOS: new MemoryObjectStore(),
  PORTAL_ENVIRONMENT: "development",
  PORTAL_DEV_IDENTITY: DEV_IDENTITY,
  PORTAL_INTAKE_TOKEN: INTAKE_TOKEN,
};

const server = createServer((incoming, outgoing) => {
  void serve(incoming, outgoing);
});

async function serve(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  try {
    const request = await toRequest(incoming);
    const response = await handleRequest(request, env);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
    outgoing.end(body ?? undefined);
  } catch (error) {
    console.error("dev server error", error);
    outgoing.statusCode = 500;
    outgoing.setHeader("Content-Type", "text/plain; charset=utf-8");
    outgoing.end("Dev server error — see the console.");
  }
}

async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const url = new URL(incoming.url ?? "/", `http://${HOST}:${PORT}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = incoming.method ?? "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });

  const chunks: Buffer[] = [];
  for await (const chunk of Readable.from(incoming)) chunks.push(Buffer.from(chunk as Buffer));
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

server.listen(PORT, HOST, () => {
  console.log(`Home Placer portal (dev) → http://${HOST}:${PORT}`);
  console.log(`Signed in as ${DEV_IDENTITY}. Override with PORTAL_DEV_IDENTITY, or the X-Portal-Dev-Identity header.`);
  console.log(`Database: ${DB_PATH === ":memory:" ? "in memory (resets on restart)" : DB_PATH}`);
  console.log(`Warranty intake: POST /api/public/warranty-requests with "Authorization: Bearer ${INTAKE_TOKEN}" (local only).`);
});
