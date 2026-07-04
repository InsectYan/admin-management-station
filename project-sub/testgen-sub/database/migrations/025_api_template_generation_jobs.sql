-- 接口模板 AI 生成任务表
CREATE TABLE IF NOT EXISTS api_template_generation_jobs (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  project_code    VARCHAR(64),
  project_name    VARCHAR(255),
  options         JSONB DEFAULT '{}',
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  current_phase   VARCHAR(32) DEFAULT 'analyze',
  progress        JSONB DEFAULT '{"overall_percent":0,"analyze":0,"generate":0,"review":0}',
  steps_log       JSONB DEFAULT '[]',
  agent_context   JSONB DEFAULT '{}',
  error_message   TEXT,
  import_status   VARCHAR(32) DEFAULT 'pending',
  imported_count  INTEGER DEFAULT 0,
  created_by      VARCHAR(100),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tpl_gen_jobs_status ON api_template_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_api_tpl_gen_jobs_project ON api_template_generation_jobs(project_code);

COMMENT ON TABLE api_template_generation_jobs IS '接口模板 AI 生成任务（文档驱动，用户确认后入库）';
