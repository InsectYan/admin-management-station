ALTER TABLE cartoon_tasks ADD COLUMN IF NOT EXISTS precheck_workflow_id INTEGER;
ALTER TABLE cartoon_tasks ADD COLUMN IF NOT EXISTS precheck_gap JSONB;
