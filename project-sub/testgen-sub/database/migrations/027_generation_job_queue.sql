-- 用例生成执行队列（仅保留等待中/进行中/已暂停；完成后删除）
CREATE TABLE IF NOT EXISTS generation_job_queue (
  id              SERIAL PRIMARY KEY,
  job_id          INT NOT NULL UNIQUE REFERENCES generation_jobs(id) ON DELETE CASCADE,
  task_name       VARCHAR(255) NOT NULL,
  queue_status    VARCHAR(32) NOT NULL DEFAULT 'waiting',
  queue_order     INT NOT NULL DEFAULT 0,
  payload         JSONB NOT NULL DEFAULT '{}',
  progress_percent INT NOT NULL DEFAULT 0,
  current_phase   VARCHAR(32) DEFAULT 'analyze',
  project_code    VARCHAR(64),
  project_name    VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_job_queue_status_order
  ON generation_job_queue (queue_status, queue_order, id);

COMMENT ON TABLE generation_job_queue IS '用例生成任务队列（完成后删行，进度与 payload 供暂停恢复）';
