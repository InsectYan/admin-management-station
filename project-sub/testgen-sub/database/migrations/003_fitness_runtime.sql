-- Fitness 测试计划运行时表 + 执行层表（v4）

CREATE TABLE IF NOT EXISTS test_plan (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  version_tag     VARCHAR(64),
  env_name        VARCHAR(64),
  plan_type       VARCHAR(32) NOT NULL DEFAULT 'release',
  status          VARCHAR(32) NOT NULL DEFAULT 'draft',
  period_start    DATE,
  period_end      DATE,
  notes           TEXT,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_plan_scope (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  scope_type      VARCHAR(32) NOT NULL,
  scope_value     VARCHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_plan_scope_plan ON test_plan_scope(plan_id);

CREATE TABLE IF NOT EXISTS test_plan_threshold (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  param_id        VARCHAR(64) NOT NULL,
  param_value     NUMERIC(12, 4) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_plan_threshold_plan ON test_plan_threshold(plan_id);

CREATE TABLE IF NOT EXISTS test_plan_item (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  item_id         VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id),
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_test_plan_item_plan ON test_plan_item(plan_id);

CREATE TABLE IF NOT EXISTS test_plan_item_result (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  plan_item_id    INT NOT NULL REFERENCES test_plan_item(id) ON DELETE CASCADE,
  result_status   VARCHAR(16) NOT NULL DEFAULT 'pending',
  validation_result VARCHAR(32),
  notes           TEXT,
  defect_url      VARCHAR(512),
  ft_run_id       INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_plan_report (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  report_format   VARCHAR(16) NOT NULL DEFAULT 'markdown',
  content         TEXT,
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 执行层（与已有 test_runs 区分，前缀 ft_）

CREATE TABLE IF NOT EXISTS ft_execution_env (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(128) NOT NULL,
  config_env_id   VARCHAR(64),
  bff_coach_url   VARCHAR(512),
  bff_member_url  VARCHAR(512),
  bff_manager_url VARCHAR(512),
  agent_chat_url  VARCHAR(512),
  auth_configured JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ft_sample_set (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  tags            JSONB NOT NULL DEFAULT '[]',
  item_id         VARCHAR(64),
  prefix_pattern  VARCHAR(128),
  sample_count    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ft_sample_item (
  id              SERIAL PRIMARY KEY,
  sample_set_id   INT NOT NULL REFERENCES ft_sample_set(id) ON DELETE CASCADE,
  input_data      JSONB NOT NULL DEFAULT '{}',
  expected_data   JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_sample_item_set ON ft_sample_item(sample_set_id);

CREATE TABLE IF NOT EXISTS ft_run_config (
  id              SERIAL PRIMARY KEY,
  item_id         VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id),
  scheme_id       VARCHAR(16) NOT NULL,
  config_json     JSONB NOT NULL DEFAULT '{}',
  threshold_json  JSONB NOT NULL DEFAULT '{}',
  env_id          INT REFERENCES ft_execution_env(id),
  sample_set_id   INT REFERENCES ft_sample_set(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_run_config_item ON ft_run_config(item_id);

CREATE TABLE IF NOT EXISTS ft_run (
  id              SERIAL PRIMARY KEY,
  item_id         VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id),
  run_config_id   INT REFERENCES ft_run_config(id),
  env_id          INT REFERENCES ft_execution_env(id),
  scheme_id       VARCHAR(16) NOT NULL,
  validation_id   VARCHAR(20),
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  progress        JSONB NOT NULL DEFAULT '{}',
  verdict         VARCHAR(16),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_run_item ON ft_run(item_id);
CREATE INDEX IF NOT EXISTS idx_ft_run_status ON ft_run(status);

CREATE TABLE IF NOT EXISTS ft_run_result (
  id              SERIAL PRIMARY KEY,
  ft_run_id       INT NOT NULL REFERENCES ft_run(id) ON DELETE CASCADE,
  sub_index       INT NOT NULL DEFAULT 0,
  input_summary   TEXT,
  output_summary  TEXT,
  assertion_detail JSONB NOT NULL DEFAULT '[]',
  sub_verdict     VARCHAR(16),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_run_result_run ON ft_run_result(ft_run_id);

-- 项目管理 · 环境模板（017 迁移与之等价，供新装库使用）
CREATE TABLE IF NOT EXISTS project_env_template (
  id              SERIAL PRIMARY KEY,
  project_code    VARCHAR(64) NOT NULL REFERENCES test_project(project_code) ON DELETE CASCADE,
  name            VARCHAR(128) NOT NULL,
  tier            VARCHAR(32) NOT NULL DEFAULT 'staging',
  base_url        VARCHAR(512),
  base_path       VARCHAR(256) NOT NULL DEFAULT '/',
  auth_type       VARCHAR(32) NOT NULL DEFAULT 'none',
  auth_secret     TEXT,
  db_host         VARCHAR(256),
  db_port         VARCHAR(16) DEFAULT '5432',
  db_name         VARCHAR(128),
  db_user         VARCHAR(128),
  db_password     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_code, name)
);

CREATE INDEX IF NOT EXISTS idx_project_env_template_project ON project_env_template(project_code);
