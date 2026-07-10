-- 021: 接口请求模板 + 样本集类型（http / text / inject）
-- 用途：配置管理 · 接口模板管理；样本集多类型；用例注入字段与多样本执行

CREATE TABLE IF NOT EXISTS ft_api_template (
  id              SERIAL PRIMARY KEY,
  template_code   VARCHAR(64) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  project_code    VARCHAR(64),
  http_method     VARCHAR(16) NOT NULL DEFAULT 'POST',
  url_path        VARCHAR(512) NOT NULL,
  headers_json    JSONB NOT NULL DEFAULT '{}',
  query_json      JSONB NOT NULL DEFAULT '{}',
  body_template   JSONB NOT NULL DEFAULT '{}',
  inject_schema   JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_api_template_project ON ft_api_template(project_code);
CREATE INDEX IF NOT EXISTS idx_ft_api_template_active ON ft_api_template(is_active);

COMMENT ON TABLE ft_api_template IS 'HTTP 接口请求模板（可声明 inject_schema 注入点）';
COMMENT ON COLUMN ft_api_template.inject_schema IS '[{key,label,location,json_path,description}] location=body|header|query|path';

ALTER TABLE ft_sample_set
  ADD COLUMN IF NOT EXISTS set_type VARCHAR(16) NOT NULL DEFAULT 'http';

ALTER TABLE ft_sample_set
  ADD COLUMN IF NOT EXISTS api_template_id INT REFERENCES ft_api_template(id) ON DELETE SET NULL;

ALTER TABLE ft_sample_set
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN ft_sample_set.set_type IS 'http=完整HTTP样本 | text=文本行样本 | inject=接口模板字段组合样本';

ALTER TABLE ft_run_config
  ADD COLUMN IF NOT EXISTS api_template_id INT REFERENCES ft_api_template(id) ON DELETE SET NULL;

ALTER TABLE ft_run_config
  ADD COLUMN IF NOT EXISTS use_api_template BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ft_run_config
  ADD COLUMN IF NOT EXISTS inject_bindings JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN ft_run_config.inject_bindings IS '{fieldKey:{mode:manual|sample_set,value?,sample_set_id?,field_key?}}';

-- 演示种子：教练 submit 接口模板
INSERT INTO ft_api_template (
  template_code, name, description, project_code,
  http_method, url_path, headers_json, body_template, inject_schema,
  created_at, updated_at
)
SELECT
  'coach-turn-submit',
  '教练 Turn Submit',
  'POST /turns/submit 示例：可注入 coach_id / message',
  'fitness-agent',
  'POST',
  '/turns/submit',
  '{"Content-Type":"application/json"}'::jsonb,
  '{"coach_id":0,"session_id":"","client_turn_id":"","message":""}'::jsonb,
  '[
    {"key":"coach_id","label":"教练 ID","location":"body","json_path":"coach_id"},
    {"key":"message","label":"消息内容","location":"body","json_path":"message"},
    {"key":"session_id","label":"Session ID","location":"body","json_path":"session_id"}
  ]'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM ft_api_template WHERE template_code = 'coach-turn-submit');
