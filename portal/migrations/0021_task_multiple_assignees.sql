-- A task can have several employees assigned without losing its existing
-- single-assignee compatibility field. `assigned_to` remains the first
-- assignee for older integrations; this table is the full source of truth.
CREATE TABLE work_task_assignees (
  task_id TEXT NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES employees(id),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, employee_id)
);

CREATE INDEX idx_task_assignees_employee ON work_task_assignees(employee_id, task_id);

INSERT INTO work_task_assignees (task_id, employee_id, assigned_by, assigned_at)
SELECT id, assigned_to, created_by, updated_at
  FROM work_tasks
 WHERE assigned_to IS NOT NULL;
