-- A task can ask the crew to move several pieces of equipment to its selected
-- subdivision or home. Keep the original single asset_id column for older
-- integrations, while making the join table the complete task equipment list.
CREATE TABLE work_task_assets (
  work_task_id TEXT NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (work_task_id, asset_id)
);

INSERT OR IGNORE INTO work_task_assets (work_task_id, asset_id, created_at)
SELECT id, asset_id, created_at
  FROM work_tasks
 WHERE asset_id IS NOT NULL;

CREATE INDEX idx_work_task_assets_asset ON work_task_assets(asset_id, work_task_id);
