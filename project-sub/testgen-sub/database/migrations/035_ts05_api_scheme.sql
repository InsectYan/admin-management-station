-- TS-05-API：前置链路+接口模板专用方案（与 TS-05-CHAIN 共用 ts05ChainEngine，execution_mode=api_ctx）
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order)
VALUES (
  'TS-05-API',
  '前置链路+接口模板',
  'preflight + ft_api_template + poll/语义比对（api_ctx）',
  11
) ON CONFLICT (scheme_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES
  ('P19', 'TS-05-API', 'VS-04-CHAIN-OK', TRUE),
  ('P19B', 'TS-05-API', 'VS-07-RATE-H', FALSE),
  ('P19C', 'TS-05-API', 'VS-03-ZERO', FALSE),
  ('P19D', 'TS-05-API', 'VS-01-EXACT', FALSE),
  ('P19E', 'TS-05-API', 'VS-02-CONTRACT', FALSE)
ON CONFLICT (pair_id) DO NOTHING;

UPDATE config_template_enum
SET scheme_id = 'TS-05-API'
WHERE template_code = 'TPL-API-CTX';

UPDATE test_item_detail
SET scheme_primary_id = 'TS-05-API', updated_at = NOW()
WHERE template_code = 'TPL-API-CTX'
  AND scheme_primary_id IN ('TS-05-CHAIN', 'TS-05-API');

UPDATE test_item_prefix_scheme
SET scheme_primary_id = 'TS-05-API',
    validation_primary_id = COALESCE(validation_primary_id, 'VS-04-CHAIN-OK'),
    sample_execution_note = COALESCE(sample_execution_note, '前置链路+接口模板')
WHERE item_prefix = 'C1-INTENT-008';
