-- TPL-API-CTX：前置链路 + 接口模板批量文案（执行方案仍用 TS-05-CHAIN 引擎）

CREATE TABLE IF NOT EXISTS tpl_config_api_ctx (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO config_template_enum (
  template_code, name, description, scheme_id, panel_key, table_name,
  agent_skill, agent_action, sort_order
) VALUES (
  'TPL-API-CTX',
  '前置链路+接口模板',
  '前置链路 extract 取参，多条文案接口分别断言合规',
  'TS-05-CHAIN',
  'api-ctx',
  'tpl_config_api_ctx',
  'fitness-config-skill',
  'generate_api_ctx',
  11
) ON CONFLICT (template_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scheme_id = EXCLUDED.scheme_id,
  panel_key = EXCLUDED.panel_key,
  table_name = EXCLUDED.table_name,
  agent_skill = EXCLUDED.agent_skill,
  agent_action = EXCLUDED.agent_action,
  sort_order = EXCLUDED.sort_order;
