/** A path-pattern router. Patterns use `:name` segments and an optional `*` tail. */
import type { RequestContext } from "./context.ts";

export type Handler = (ctx: RequestContext) => Promise<Response>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export interface Match {
  handler: Handler;
  params: Record<string, string>;
}

function split(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

export class Router {
  readonly #routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.#routes.push({ method, segments: split(pattern), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.add("GET", pattern, handler);
  }

  post(pattern: string, handler: Handler): this {
    return this.add("POST", pattern, handler);
  }

  delete(pattern: string, handler: Handler): this {
    return this.add("DELETE", pattern, handler);
  }

  match(method: string, pathname: string): Match | null {
    const parts = split(pathname);
    const normalizedMethod = method === "HEAD" ? "GET" : method;
    for (const route of this.#routes) {
      if (route.method !== normalizedMethod) continue;
      const params = matchSegments(route.segments, parts);
      if (params) return { handler: route.handler, params };
    }
    return null;
  }

  /** Which methods a path would accept — used to answer 405 honestly. */
  allowedMethods(pathname: string): string[] {
    const parts = split(pathname);
    const methods = new Set<string>();
    for (const route of this.#routes) {
      if (matchSegments(route.segments, parts)) methods.add(route.method);
    }
    return [...methods];
  }
}

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i += 1) {
    const segment = pattern[i];
    if (segment === "*") {
      params.rest = parts.slice(i).join("/");
      return params;
    }
    const part = parts[i];
    if (part === undefined) return null;
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(part);
      continue;
    }
    if (segment !== part) return null;
  }
  return pattern.length === parts.length ? params : null;
}
