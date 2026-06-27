-- 接口测试执行扩展（apitest 迭代）

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS http_config JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_test_cases_http_config ON test_cases USING GIN (http_config);

CREATE TABLE IF NOT EXISTS env_configs (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  base_url        VARCHAR(1024) NOT NULL,
  headers_template JSONB DEFAULT '{}',
  variables       JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_env_configs_name ON env_configs (name);

INSERT INTO env_configs (name, description, base_url, headers_template)
SELECT 'local', '本地开发环境', 'http://localhost:8080', '{}'
WHERE NOT EXISTS (SELECT 1 FROM env_configs WHERE name = 'local');

INSERT INTO env_configs (name, description, base_url, headers_template)
SELECT 'staging', '预发环境', 'http://staging.internal', '{}'
WHERE NOT EXISTS (SELECT 1 FROM env_configs WHERE name = 'staging');

CREATE TABLE IF NOT EXISTS test_runs (
  id                SERIAL PRIMARY KEY,
  batch_id          UUID,
  case_id           INT REFERENCES test_cases(id) ON DELETE SET NULL,
  env_id            INT REFERENCES env_configs(id) ON DELETE SET NULL,
  mode              VARCHAR(16) NOT NULL DEFAULT 'functional',
  status            VARCHAR(16) NOT NULL DEFAULT 'pending',
  progress          REAL DEFAULT 0,
  concurrency       INT DEFAULT 1,
  total_requests    INT,
  success_requests  INT,
  error_requests    INT,
  perf_analysis     JSONB DEFAULT NULL,
  perf_analysis_status VARCHAR(16) DEFAULT 'none',
  agent_run_id      INT,
  error_message     TEXT,
  log_tail          TEXT,
  perf_options      JSONB DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_runs_case ON test_runs (case_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs (status);
CREATE INDEX IF NOT EXISTS idx_test_runs_batch ON test_runs (batch_id);

CREATE TABLE IF NOT EXISTS func_results (
  id               SERIAL PRIMARY KEY,
  run_id           INT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  request_index    INT DEFAULT 0,
  status           VARCHAR(16) NOT NULL,
  response_time_ms INT,
  http_status_code INT,
  response_body    JSONB,
  error_message    TEXT,
  assertion_details JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_func_results_run ON func_results (run_id);

CREATE TABLE IF NOT EXISTS perf_results (
  id                 SERIAL PRIMARY KEY,
  run_id             INT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  window_start       TIMESTAMPTZ NOT NULL,
  tps                REAL,
  avg_response_time_ms INT,
  p95_response_time_ms INT,
  error_rate         REAL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_results_run ON perf_results (run_id);
