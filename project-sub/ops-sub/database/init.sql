-- ops-sub 基线 Schema（幂等）
-- 运维项目管理：目录树、路由、功能流程图均以 JSONB 存储

CREATE TABLE IF NOT EXISTS ops_projects (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  project_type    VARCHAR(32)  NOT NULL DEFAULT 'frontend',
  description     TEXT,
  repo_url        VARCHAR(500),
  source_path     VARCHAR(1000),
  status          VARCHAR(32)  NOT NULL DEFAULT 'draft',
  directory_tree  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  routes          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  flows           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  extra_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_projects_type ON ops_projects (project_type);
CREATE INDEX IF NOT EXISTS idx_ops_projects_status ON ops_projects (status);
CREATE INDEX IF NOT EXISTS idx_ops_projects_name ON ops_projects (name);
CREATE INDEX IF NOT EXISTS idx_ops_projects_updated_at ON ops_projects (updated_at DESC);
