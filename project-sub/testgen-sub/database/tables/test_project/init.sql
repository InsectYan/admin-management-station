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

-- 数据导入（3 条 · 三端项目）
INSERT INTO test_project (project_code, project_name, team, status, description, repo_urls, cicd_config, member_roles, last_active_at) VALUES ('lejian-wx-miniapp', '启炼前端 · 微信小程序', 'QA 团队', 'active', 'lejian-wx-miniapp：教练/会员/店长前端呈现、交互、流式卡片与权限门禁。', '["lejian-wx-miniapp"]'::jsonb, '{"provider":"manual","pipeline":""}'::jsonb, '[{"user":"admin","role":"owner"}]'::jsonb, NOW()) ON CONFLICT (project_code) DO UPDATE SET project_name = EXCLUDED.project_name, description = EXCLUDED.description, updated_at = NOW();
INSERT INTO test_project (project_code, project_name, team, status, description, repo_urls, cicd_config, member_roles, last_active_at) VALUES ('lejian-business-service', '启炼服务端 · 业务 API', 'QA 团队', 'active', 'lejian-business-service：/miniapp/* 与 /agent/* 接口、状态机、鉴权与 Agent 读数。', '["lejian-business-service"]'::jsonb, '{"provider":"manual","pipeline":""}'::jsonb, '[{"user":"admin","role":"owner"}]'::jsonb, NOW()) ON CONFLICT (project_code) DO UPDATE SET project_name = EXCLUDED.project_name, description = EXCLUDED.description, updated_at = NOW();
INSERT INTO test_project (project_code, project_name, team, status, description, repo_urls, cicd_config, member_roles, last_active_at) VALUES ('fitness-agent', '启炼 Agent · Pi', 'QA 团队', 'active', 'fitness-agent/.pi：场景围栏、emit 契约、教练工作流、会员/店长边界与 HTTP。', '["fitness-agent"]'::jsonb, '{"provider":"manual","pipeline":"npm test"}'::jsonb, '[{"user":"admin","role":"owner"}]'::jsonb, NOW()) ON CONFLICT (project_code) DO UPDATE SET project_name = EXCLUDED.project_name, description = EXCLUDED.description, updated_at = NOW();
