/**
 * Server-side authorization.
 *
 * Every read and write in the portal goes through `can()` / `assertCan()` in
 * the API layer. The UI hides controls a role cannot use, but that is only
 * cosmetic — hitting the endpoint directly hits the same check.
 */
import { forbidden } from "../platform/errors.ts";
import type { AccessIdentity } from "./access.ts";

export type Role = "employee" | "supervisor" | "billing" | "admin";

export const ROLES: readonly Role[] = ["employee", "supervisor", "billing", "admin"];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export type Permission =
  | "job.read"
  | "job.write"
  // Naming a new subdivision is field work: a crew that arrives at a site we
  // have no record of should be able to create it without waiting on the office.
  | "subdivision.create"
  | "lot.write"
  | "home.read"
  | "home.write"
  // The site address and the owner of record are what a crew standing at the
  // home actually knows, so editing them is not held behind home.write.
  | "home.address.edit"
  | "home.workflow.edit"
  | "home.report.submit"
  | "asset.read"
  | "asset.write"
  | "asset.service.record"
  | "inspection.submit"
  | "defect.report"
  | "defect.resolve"
  | "task.read.all"
  | "task.assign"
  | "task.complete.any"
  | "repair.create"
  | "repair.read.all"
  | "repair.approve"
  | "repair.edit"
  | "repair.bill"
  | "inventory.read"
  | "inventory.adjust"
  | "inventory.manage"
  | "material_request.create"
  | "material_request.approve"
  | "document.upload"
  | "employee.manage"
  | "monday.manage"
  | "monday.import"
  | "warranty.review"
  | "notification.route.manage"
  | "audit.read";

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "job.read",
  "subdivision.create",
  "home.read",
  "home.address.edit",
  "home.workflow.edit",
  "asset.read",
  "inspection.submit",
  "defect.report",
  "repair.create",
  "inventory.read",
  "material_request.create",
  "document.upload",
];

const SUPERVISOR_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  "job.write",
  "lot.write",
  "home.write",
  "home.report.submit",
  "asset.write",
  "asset.service.record",
  "defect.resolve",
  "warranty.review",
  "task.read.all",
  "task.assign",
  "task.complete.any",
  "repair.read.all",
  "repair.approve",
  "repair.edit",
  "inventory.adjust",
  "material_request.approve",
];

// Billing runs the bill-back queue and buys parts. It deliberately cannot
// assign field work or edit equipment records.
const BILLING_PERMISSIONS: Permission[] = [
  "job.read",
  "home.read",
  "home.workflow.edit",
  "asset.read",
  "warranty.review",
  "inventory.read",
  "inventory.adjust",
  "inventory.manage",
  "material_request.create",
  "material_request.approve",
  "repair.read.all",
  "repair.edit",
  "repair.bill",
  "document.upload",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...SUPERVISOR_PERMISSIONS,
  ...BILLING_PERMISSIONS,
  "employee.manage",
  "monday.manage",
  "monday.import",
  "notification.route.manage",
  "audit.read",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  employee: new Set(EMPLOYEE_PERMISSIONS),
  supervisor: new Set(SUPERVISOR_PERMISSIONS),
  billing: new Set(BILLING_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
};

export interface Actor {
  employeeId: string;
  email: string;
  displayName: string;
  /** Primary role plus any additional grants from employee_role_grants. */
  roles: Role[];
  primaryRole: Role;
  identity: AccessIdentity;
}

export function can(actor: Actor, permission: Permission): boolean {
  return actor.roles.some((role) => ROLE_PERMISSIONS[role].has(permission));
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw forbidden(`Your role (${actor.roles.join(", ")}) cannot ${permission.replace(/\./g, " ")}`);
  }
}

export function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role);
}

/**
 * Row-level guard for records that belong to one person. An employee sees the
 * work assigned to them or raised by them; anyone holding `permission` sees
 * everything.
 */
export function assertOwnerOr(actor: Actor, permission: Permission, ...ownerIds: (string | null | undefined)[]): void {
  if (can(actor, permission)) return;
  if (ownerIds.some((id) => id && id === actor.employeeId)) return;
  throw forbidden();
}

export function isOwnerOr(actor: Actor, permission: Permission, ...ownerIds: (string | null | undefined)[]): boolean {
  if (can(actor, permission)) return true;
  return ownerIds.some((id) => id && id === actor.employeeId);
}
