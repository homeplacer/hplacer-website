-- Current operating roles confirmed by Home Placer leadership on 2026-08-23.
-- Future supervisor accounts (Greg and Joe) can receive the same alerts simply
-- by being granted the supervisor role when their verified email accounts exist.

INSERT OR IGNORE INTO employee_role_grants (employee_id, role, granted_by)
VALUES
  ('emp_tara_dufour', 'billing', 'emp_carolina_admin'),
  ('emp_tara_dufour', 'supervisor', 'emp_carolina_admin'),
  ('emp_brett_chester', 'supervisor', 'emp_carolina_admin'),
  ('emp_brandon_angelo', 'supervisor', 'emp_carolina_admin');

INSERT OR IGNORE INTO notification_routes
  (id, category, recipient_kind, recipient_role, recipient_employee_id, active, created_by)
VALUES
  ('route_inventory_billing', 'inventory_low', 'role', 'billing', NULL, 1, 'emp_carolina_admin'),
  ('route_material_billing', 'material_requested', 'role', 'billing', NULL, 1, 'emp_carolina_admin'),
  ('route_billback_billing', 'billing_ready', 'role', 'billing', NULL, 1, 'emp_carolina_admin'),
  ('route_repair_supervisors', 'repair_reported', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin'),
  ('route_inspection_supervisors', 'inspection_failed', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin'),
  ('route_defect_supervisors', 'defect_reported', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin'),
  ('route_service_supervisors', 'service_due', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin'),
  ('route_warranty_supervisors', 'warranty_request', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin'),
  ('route_digest_supervisors', 'daily_digest', 'role', 'supervisor', NULL, 1, 'emp_carolina_admin');
