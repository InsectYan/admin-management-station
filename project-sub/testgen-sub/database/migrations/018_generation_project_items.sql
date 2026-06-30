-- 生成任务关联项目；测试项落库 generation_job_id

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(64),
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

ALTER TABLE generation_jobs ALTER COLUMN module DROP NOT NULL;

ALTER TABLE test_item_detail
  ADD COLUMN IF NOT EXISTS generation_job_id INT;

CREATE INDEX IF NOT EXISTS idx_test_item_generation_job ON test_item_detail(generation_job_id);
