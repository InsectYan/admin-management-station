-- 接口模板：前置链路、外部入参、执行断言（poll/forbidden）

ALTER TABLE ft_api_template ADD COLUMN IF NOT EXISTS input_params_schema JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ft_api_template ADD COLUMN IF NOT EXISTS preflight_steps JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ft_api_template ADD COLUMN IF NOT EXISTS expect_status INT NOT NULL DEFAULT 202;
ALTER TABLE ft_api_template ADD COLUMN IF NOT EXISTS poll_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ft_api_template ADD COLUMN IF NOT EXISTS forbidden_patterns JSONB NOT NULL DEFAULT '[]';

-- TS-05-CHAIN / TPL-API-CTX 可关联全部常用验证
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES
  ('P09B', 'TS-05-CHAIN', 'VS-07-RATE-H', FALSE),
  ('P09C', 'TS-05-CHAIN', 'VS-03-ZERO', FALSE),
  ('P09D', 'TS-05-CHAIN', 'VS-01-EXACT', FALSE),
  ('P09E', 'TS-05-CHAIN', 'VS-02-CONTRACT', FALSE)
ON CONFLICT (pair_id) DO NOTHING;
