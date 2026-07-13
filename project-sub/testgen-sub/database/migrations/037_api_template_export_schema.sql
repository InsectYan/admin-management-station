-- 接口模板：可抛出字段声明（前置链路成功后供用例主请求使用）
ALTER TABLE ft_api_template
  ADD COLUMN IF NOT EXISTS export_schema JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN ft_api_template.export_schema IS
  '可抛出字段 [{key,label,source,json_path,usage_hint}]，前置链路 extract 成功后写入变量池';
