-- 项目级部署产品配置（AgentRun / ECS demo / 腾讯云 demo）

ALTER TABLE ops_projects
  ADD COLUMN IF NOT EXISTS deploy_config JSONB NOT NULL DEFAULT '{}'::jsonb;
