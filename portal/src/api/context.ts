/** Per-request state handed to every route handler. */
import type { Actor } from "../auth/authz.ts";
import { badRequest } from "../platform/errors.ts";
import type { Db, ObjectStore, PortalEnv } from "../platform/types.ts";
import type { MondaySyncPort } from "../integrations/monday.ts";

export interface RequestContext {
  request: Request;
  url: URL;
  env: PortalEnv;
  db: Db;
  store?: ObjectStore;
  actor: Actor;
  params: Record<string, string>;
  monday: MondaySyncPort;
  requestId: string;
}

export type Fields = Record<string, string | undefined>;

const MAX_BODY_BYTES = 20 * 1024 * 1024;

/**
 * Reads a request body as a flat field map, accepting both the HTML forms the
 * portal renders and JSON from a script. Files are handled separately by the
 * upload route.
 */
export async function readFields(request: Request): Promise<Fields> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      throw badRequest("Body is not valid JSON");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw badRequest("Body must be a JSON object");
    }
    const fields: Fields = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      fields[key] = typeof value === "boolean" ? (value ? "on" : "") : String(value);
    }
    return fields;
  }

  if (contentType.includes("form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const fields: Fields = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
    }
    return fields;
  }

  throw badRequest("Unsupported content type");
}

/** Repeated form inputs, e.g. one row per checklist item. */
export async function readForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("form-urlencoded") && !contentType.includes("multipart/form-data")) {
    throw badRequest("Expected a form submission");
  }
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY_BYTES) throw badRequest("That upload is too large");
  return request.formData();
}

export function requiredField(fields: Fields, name: string, label = name): string {
  const value = fields[name]?.trim();
  if (!value) throw badRequest(`${label} is required`);
  return value;
}

export function optionalField(fields: Fields, name: string): string | null {
  const value = fields[name]?.trim();
  return value ? value : null;
}

export function numberField(fields: Fields, name: string, label = name): number | null {
  const value = fields[name]?.trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${label} must be a number`);
  return parsed;
}

/** Dollars in the form, integer cents in the database. */
export function centsField(fields: Fields, name: string, label = name): number | null {
  const value = fields[name]?.trim();
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) throw badRequest(`${label} must be a dollar amount`);
  return Math.round(parsed * 100);
}

export function boolField(fields: Fields, name: string): boolean {
  const value = fields[name];
  return value === "on" || value === "true" || value === "1" || value === "yes";
}
