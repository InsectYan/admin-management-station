CREATE TABLE IF NOT EXISTS test_project (
  project_code VARCHAR(64) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  team VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  description TEXT,
  repo_urls JSONB NOT NULL DEFAULT '[]',
  cicd_config JSONB NOT NULL DEFAULT '{}',
  member_roles JSONB NOT NULL DEFAULT '[]',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_project_status ON test_project(status);
CREATE INDEX IF NOT EXISTS idx_test_project_team ON test_project(team);
CREATE INDEX IF NOT EXISTS idx_test_project_last_active ON test_project(last_active_at DESC);

INSERT INTO test_project (project_code, project_name, team, status, description, repo_urls, cicd_config, member_roles, last_active_at) VALUES ('fitness-agent', 'Fitness Agent 测试项目', 'QA 团队', 'active', 'Fitness Agent 智能健身平台全量测试用例库，涵盖六站流水线、业务功能、Agent 质量等维度。', '["https://github.com/example/fitness-agent"]'::jsonb, '{"provider":"github-actions","pipeline":"ci-test.yml"}'::jsonb, '[{"user":"admin","role":"owner"},{"user":"qa-lead","role":"editor"}]'::jsonb, NOW()) ON CONFLICT (project_code) DO NOTHING;
