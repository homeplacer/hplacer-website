/** Errors the router maps onto HTTP status codes. */

export class PortalError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message);
    this.name = "PortalError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const badRequest = (message: string, detail?: string): PortalError =>
  new PortalError(400, "bad_request", message, detail);

export const unauthorized = (message = "Not signed in"): PortalError =>
  new PortalError(401, "unauthorized", message);

export const forbidden = (message = "You do not have access to this record"): PortalError =>
  new PortalError(403, "forbidden", message);

export const notFound = (message = "Not found"): PortalError =>
  new PortalError(404, "not_found", message);

export const conflict = (message: string, detail?: string): PortalError =>
  new PortalError(409, "conflict", message, detail);

export function isPortalError(error: unknown): error is PortalError {
  return error instanceof PortalError;
}
