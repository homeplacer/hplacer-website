/**
 * Turns a verified Access identity into a portal `Actor`.
 *
 * Employees are never auto-provisioned. Passing the Access policy proves who
 * you are; it does not grant portal access. An admin has to create the
 * employee row first, which keeps role assignment an explicit act.
 */
import type { Db } from "../platform/types.ts";
import { forbidden, PortalError } from "../platform/errors.ts";
import { nowIso } from "../platform/ids.ts";
import type { AccessIdentity } from "./access.ts";
import { isRole, type Actor, type Role } from "./authz.ts";

interface EmployeeRow {
  id: string;
  access_subject: string;
  email: string;
  display_name: string;
  role: string;
  active: number;
}

export async function loadActor(db: Db, identity: AccessIdentity): Promise<Actor> {
  let employee = await db
    .prepare("SELECT id, access_subject, email, display_name, role, active FROM employees WHERE access_subject = ?")
    .bind(identity.subject)
    .first<EmployeeRow>();

  if (!employee) {
    // First sign-in: bind the Access subject to the pre-created email row.
    employee = await db
      .prepare("SELECT id, access_subject, email, display_name, role, active FROM employees WHERE email = ?")
      .bind(identity.email)
      .first<EmployeeRow>();

    if (employee) {
      await db
        .prepare("UPDATE employees SET access_subject = ?, updated_at = ? WHERE id = ?")
        .bind(identity.subject, nowIso(), employee.id)
        .run();
    }
  }

  if (!employee) {
    throw forbidden(`${identity.email} is not set up in the portal. Ask an administrator to add you.`);
  }
  if (employee.active !== 1) {
    throw forbidden(`${identity.email} is deactivated.`);
  }
  if (!isRole(employee.role)) {
    throw new PortalError(500, "bad_role", `Employee ${employee.id} has an unknown role`);
  }

  const grants = await db
    .prepare("SELECT role FROM employee_role_grants WHERE employee_id = ?")
    .bind(employee.id)
    .all<{ role: string }>();

  const roles: Role[] = [employee.role];
  for (const grant of grants.results) {
    if (isRole(grant.role) && !roles.includes(grant.role)) roles.push(grant.role);
  }

  await db
    .prepare("UPDATE employees SET last_seen_at = ? WHERE id = ?")
    .bind(nowIso(), employee.id)
    .run();

  return {
    employeeId: employee.id,
    email: employee.email,
    displayName: employee.display_name,
    roles,
    primaryRole: employee.role,
    identity,
  };
}
