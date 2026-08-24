/** Response helpers shared by the JSON API and the HTML pages. */
import { isPortalError } from "../platform/errors.ts";
import { securityHeaders } from "../ui/layout.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: securityHeaders({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

export function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: securityHeaders({ Location: location }) });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: securityHeaders() });
}

/**
 * Short confirmation codes rather than free text in the query string, so a
 * crafted link cannot put words in the portal's mouth.
 */
export const FLASH_MESSAGES: Record<string, string> = {
  saved: "Saved.",
  inspection_passed: "Inspection filed — everything passed.",
  inspection_defects: "Inspection filed. Defects were opened and the supervisors were notified.",
  ticket_created: "Repair ticket created.",
  ticket_updated: "Repair ticket updated.",
  billed: "Marked billed back.",
  task_created: "Task created and the assignee was notified.",
  task_completed: "Task closed.",
  uploaded: "File attached.",
  linked: "Monday link recorded.",
  unlinked: "Monday link removed.",
  requested: "Material request sent to the office.",
  received: "Received into stock.",
  employee_added: "Employee added.",
  swept: "Sweep complete.",
};

export function flashFrom(url: URL): { kind: "ok"; message: string } | null {
  const code = url.searchParams.get("ok");
  if (!code) return null;
  const message = FLASH_MESSAGES[code];
  return message ? { kind: "ok", message } : null;
}

export function errorStatus(error: unknown): number {
  return isPortalError(error) ? error.status : 500;
}

export function errorMessage(error: unknown): string {
  if (isPortalError(error)) return error.message;
  return "Something went wrong. Try again, and tell the office if it keeps happening.";
}
