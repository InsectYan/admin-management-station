CREATE TABLE IF NOT EXISTS tpl_config_bnd (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tpl_config_bnd (item_id, config_json, threshold_json, config_source) VALUES
(
  'B4-PERSIST-001',
  '{"matrix":[{"name":"P1 · text 助手气泡","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-text"},{"name":"P2 · plan_form + form_data","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-plan-form"},{"name":"P3 · training_plan 载荷","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-training-plan"},{"name":"P4 · session_plan 载荷","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-session-plan"},{"name":"P5 · require_form 表单","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-require-form"},{"name":"P6 · session_summary 总结","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-session-summary"},{"name":"P7 · disambiguation","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-disambiguation"},{"name":"P8 · member_switch","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-member-switch"},{"name":"P9 · intent_clarification","runner":"cli","command":"cd server && npm run test:stations -- s04-persist-intent-clarification"}]}'::jsonb,
  '{}'::jsonb,
  'manual'
)
ON CONFLICT (item_id) DO UPDATE SET
  config_json = EXCLUDED.config_json,
  config_source = EXCLUDED.config_source,
  updated_at = NOW();
