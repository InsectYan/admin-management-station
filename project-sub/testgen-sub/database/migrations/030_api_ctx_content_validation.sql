-- TPL-API-CTX 内容验证：模板默认 VS、接口文案提取路径

ALTER TABLE config_template_enum
  ADD COLUMN IF NOT EXISTS default_validation_id VARCHAR(20) REFERENCES test_validation_enum(validation_id);

UPDATE config_template_enum
SET default_validation_id = 'VS-07-RATE-M'
WHERE template_code = 'TPL-API-CTX' AND default_validation_id IS NULL;

INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary)
VALUES
  ('P09F', 'TS-05-CHAIN', 'VS-07-RATE-L', FALSE),
  ('P09G', 'TS-05-CHAIN', 'VS-07-RATE-M', FALSE)
ON CONFLICT (pair_id) DO NOTHING;

ALTER TABLE ft_api_template
  ADD COLUMN IF NOT EXISTS content_extract_paths JSONB NOT NULL DEFAULT '["$.data.message","$.data.content","$.data.text","$.data.reply","$.message"]';

COMMENT ON COLUMN config_template_enum.default_validation_id IS '配置模板推荐的默认主验证 VS';
COMMENT ON COLUMN ft_api_template.content_extract_paths IS '响应体文案提取 json_path 列表，供观测比对';
