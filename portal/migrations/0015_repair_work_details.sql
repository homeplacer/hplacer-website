CREATE TABLE repair_work_details (
 repair_id TEXT PRIMARY KEY REFERENCES repair_tickets(id),
 date_from TEXT,
 date_to TEXT,
 mechanic TEXT,
 work_summary TEXT,
 labor_hours REAL CHECK(labor_hours IS NULL OR labor_hours >= 0),
 parts_cost_cents INTEGER CHECK(parts_cost_cents IS NULL OR parts_cost_cents >= 0),
 cost_is_estimate INTEGER NOT NULL DEFAULT 1 CHECK(cost_is_estimate IN (0,1)),
 supplier TEXT,
 completion_reported INTEGER NOT NULL DEFAULT 0 CHECK(completion_reported IN (0,1)),
 updated_by TEXT NOT NULL REFERENCES employees(id),
 updated_at TEXT NOT NULL
);
