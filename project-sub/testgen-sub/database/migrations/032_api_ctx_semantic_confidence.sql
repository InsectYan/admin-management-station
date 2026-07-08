-- 032: TPL-API-CTX 语义置信度阈值说明（threshold_json.semantic_threshold）

COMMENT ON COLUMN ft_run_result.input_summary IS '子项输入摘要；api_ctx 意图类为样本 message 文案';
COMMENT ON COLUMN ft_run_result.output_summary IS '子项输出摘要；api_ctx 意图类为 Agent response 节选';
COMMENT ON COLUMN ft_run_result.assertion_detail IS '断言详情 JSONB；api_ctx 含 semantic{confidence,response_full,...} 与 assertions[]';

-- 默认语义阈值写入 threshold_param_enum 说明（配置页可选填 semantic_threshold 0~1）
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder)
VALUES ('semantic_threshold', 'VS-07-RATE-H', '语义置信度阈值', 'ratio', 'semantic_threshold = 0.75')
ON CONFLICT (param_id) DO NOTHING;

INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder)
VALUES ('semantic_threshold_M', 'VS-07-RATE-M', '语义置信度阈值', 'ratio', 'semantic_threshold = 0.75')
ON CONFLICT (param_id) DO NOTHING;

INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder)
VALUES ('semantic_threshold_L', 'VS-07-RATE-L', '语义置信度阈值', 'ratio', 'semantic_threshold = 0.75')
ON CONFLICT (param_id) DO NOTHING;
