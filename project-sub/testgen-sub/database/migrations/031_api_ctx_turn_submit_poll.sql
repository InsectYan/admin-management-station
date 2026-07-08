-- 031: TPL-API-CTX turn submit 默认 poll + 唯一样本 client_turn_id + 文案提取路径

-- 种子模板：教练 submit
UPDATE ft_api_template
SET
  url_path = '/api/chat/turns/submit',
  expect_status = 202,
  body_template = '{
    "coach_id": 0,
    "session_id": "",
    "client_turn_id": "{{uuid}}",
    "message": ""
  }'::jsonb,
  inject_schema = '[
    {"key":"coach_id","label":"教练 ID","location":"body","json_path":"coach_id"},
    {"key":"message","label":"消息内容","location":"body","json_path":"message"},
    {"key":"session_id","label":"Session ID","location":"body","json_path":"session_id"}
  ]'::jsonb,
  poll_json = '{
    "enabled": true,
    "path": "/api/chat/turns/{{turn_id}}",
    "method": "GET",
    "expect_status": 200,
    "max_attempts": 60,
    "interval_ms": 2000,
    "until_json_path": "$.status",
    "until_value": "completed",
    "terminal_fail_statuses": ["failed", "cancelled"],
    "forbidden_on": "poll"
  }'::jsonb,
  content_extract_paths = '[
    "$.response",
    "$.data.response",
    "$.result_json.response",
    "$.message",
    "$.content"
  ]'::jsonb,
  updated_at = NOW()
WHERE template_code = 'coach-turn-submit';

-- 已配置 turn submit 但 poll 为空的模板：补默认 poll
UPDATE ft_api_template
SET
  poll_json = '{
    "enabled": true,
    "path": "/api/chat/turns/{{turn_id}}",
    "method": "GET",
    "expect_status": 200,
    "max_attempts": 60,
    "interval_ms": 2000,
    "until_json_path": "$.status",
    "until_value": "completed",
    "terminal_fail_statuses": ["failed", "cancelled"],
    "forbidden_on": "poll"
  }'::jsonb,
  content_extract_paths = CASE
    WHEN content_extract_paths IS NULL
      OR content_extract_paths = '[]'::jsonb
      OR content_extract_paths = '["$.data.message","$.data.content","$.data.text","$.data.reply","$.message"]'::jsonb
    THEN '["$.response","$.data.response","$.result_json.response","$.message","$.content"]'::jsonb
    ELSE content_extract_paths
  END,
  body_template = CASE
    WHEN (body_template->>'client_turn_id') IS NULL
      OR (body_template->>'client_turn_id') = ''
    THEN body_template || '{"client_turn_id":"{{uuid}}"}'::jsonb
    WHEN (body_template->>'client_turn_id') NOT LIKE '%{{%'
    THEN jsonb_set(body_template, '{client_turn_id}', '"{{uuid}}"'::jsonb, true)
    ELSE body_template
  END,
  updated_at = NOW()
WHERE is_active = TRUE
  AND url_path ~* '/turns/submit'
  AND (poll_json IS NULL OR poll_json = '{}'::jsonb OR poll_json = 'null'::jsonb);

COMMENT ON COLUMN ft_api_template.poll_json IS 'submit 后 poll 配置；turn submit 模板默认 until status=completed';
