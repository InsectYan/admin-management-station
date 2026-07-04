-- 执行逐步明细 + Agent Skill 审计持久化（可观测链路 Phase 2）

CREATE TABLE IF NOT EXISTS ft_run_step (
  id              SERIAL PRIMARY KEY,
  ft_run_id       INT NOT NULL REFERENCES ft_run(id) ON DELETE CASCADE,
  step_index      INT NOT NULL DEFAULT 0,
  sub_index       INT,
  step_name       VARCHAR(256),
  runner          VARCHAR(32) NOT NULL DEFAULT 'http',
  source          VARCHAR(32) NOT NULL DEFAULT 'config',
  status          VARCHAR(16) NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INT,
  trace_id        VARCHAR(64),
  input_summary   TEXT,
  output_summary  TEXT,
  detail          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_run_step_run ON ft_run_step(ft_run_id);
CREATE INDEX IF NOT EXISTS idx_ft_run_step_trace ON ft_run_step(trace_id) WHERE trace_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ft_agent_audit_log (
  id              SERIAL PRIMARY KEY,
  ft_run_id       INT REFERENCES ft_run(id) ON DELETE SET NULL,
  job_id          INT,
  item_id         VARCHAR(64),
  skill           VARCHAR(64) NOT NULL,
  action          VARCHAR(64) NOT NULL,
  trace_id        VARCHAR(64),
  ok              BOOLEAN NOT NULL DEFAULT TRUE,
  error           TEXT,
  tools           JSONB NOT NULL DEFAULT '[]',
  detail          JSONB NOT NULL DEFAULT '{}',
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_agent_audit_run ON ft_agent_audit_log(ft_run_id);
CREATE INDEX IF NOT EXISTS idx_ft_agent_audit_job ON ft_agent_audit_log(job_id);
CREATE INDEX IF NOT EXISTS idx_ft_agent_audit_trace ON ft_agent_audit_log(trace_id) WHERE trace_id IS NOT NULL;
