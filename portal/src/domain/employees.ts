/** Employee directory and role administration. */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { isRole, type Role } from "../auth/authz.ts";

export interface EmployeeRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  crew: string | null;
  phone: string | null;
  active: number;
  last_seen_at: string | null;
}

export interface EmployeeWithRoles extends EmployeeRow {
  roles: Role[];
}

export async function listEmployees(db: Db, includeInactive = false): Promise<EmployeeWithRoles[]> {
  const rows = await db
    .prepare(
      `SELECT id, email, display_name, role, crew, phone, active, last_seen_at
         FROM employees WHERE (? = 1 OR active = 1) ORDER BY display_name`,
    )
    .bind(includeInactive ? 1 : 0)
    .all<EmployeeRow>();

  const grants = await db
    .prepare("SELECT employee_id, role FROM employee_role_grants")
    .all<{ employee_id: string; role: string }>();

  const extra = new Map<string, Role[]>();
  for (const grant of grants.results) {
    if (!isRole(grant.role)) continue;
    const list = extra.get(grant.employee_id) ?? [];
    list.push(grant.role);
    extra.set(grant.employee_id, list);
  }

  return rows.results.map((row) => {
    const roles: Role[] = isRole(row.role) ? [row.role] : [];
    for (const role of extra.get(row.id) ?? []) if (!roles.includes(role)) roles.push(role);
    return { ...row, roles };
  });
}

export async function getEmployee(db: Db, id: string): Promise<EmployeeRow | null> {
  return db
    .prepare("SELECT id, email, display_name, role, crew, phone, active, last_seen_at FROM employees WHERE id = ?")
    .bind(id)
    .first<EmployeeRow>();
}

export async function listSupervisors(db: Db): Promise<EmployeeRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, email, display_name, role, crew, phone, active, last_seen_at FROM employees
        WHERE active = 1 AND (role = 'supervisor' OR role = 'admin'
              OR id IN (SELECT employee_id FROM employee_role_grants WHERE role IN ('supervisor', 'admin')))
        ORDER BY display_name`,
    )
    .all<EmployeeRow>();
  return rows.results;
}

export interface CreateEmployeeInput {
  email: string;
  displayName: string;
  role: Role;
  crew?: string | null;
  phone?: string | null;
  /** Additional hats, e.g. a supervisor who also runs the billing queue. */
  extraRoles?: Role[];
}

export async function createEmployee(db: Db, input: CreateEmployeeInput): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("A valid work email is required");
  if (!input.displayName.trim()) throw badRequest("A display name is required");
  if (!isRole(input.role)) throw badRequest("Unknown role");

  const existing = await db.prepare("SELECT id FROM employees WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) throw conflict(`${email} is already in the portal`);

  const id = newId("emp");
  const timestamp = nowIso();
  // access_subject is a placeholder until the person's first Access sign-in
  // binds the real subject (see auth/session.ts).
  await db
    .prepare(
      `INSERT INTO employees (id, access_subject, email, display_name, role, crew, phone, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(id, `pending:${email}`, email, input.displayName.trim(), input.role, input.crew ?? null, input.phone ?? null, timestamp, timestamp)
    .run();

  for (const role of input.extraRoles ?? []) {
    if (role === input.role) continue;
    await grantRole(db, id, role, null);
  }
  return id;
}

export async function grantRole(db: Db, employeeId: string, role: Role, grantedBy: string | null): Promise<void> {
  if (!isRole(role)) throw badRequest("Unknown role");
  const employee = await getEmployee(db, employeeId);
  if (!employee) throw notFound("Employee not found");
  await db
    .prepare(
      `INSERT INTO employee_role_grants (employee_id, role, granted_by, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (employee_id, role) DO NOTHING`,
    )
    .bind(employeeId, role, grantedBy, nowIso())
    .run();
}

export async function revokeRole(db: Db, employeeId: string, role: Role): Promise<void> {
  await db.prepare("DELETE FROM employee_role_grants WHERE employee_id = ? AND role = ?").bind(employeeId, role).run();
}

export async function setEmployeeActive(db: Db, employeeId: string, active: boolean): Promise<void> {
  const result = await db
    .prepare("UPDATE employees SET active = ?, updated_at = ? WHERE id = ?")
    .bind(active ? 1 : 0, nowIso(), employeeId)
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Employee not found");
}
