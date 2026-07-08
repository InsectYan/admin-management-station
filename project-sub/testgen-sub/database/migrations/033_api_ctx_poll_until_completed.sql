-- 033: poll until_value 从 UI 默认 done 修正为 fitness-agent 实际 completed

UPDATE ft_api_template
SET
  poll_json = jsonb_set(
    COALESCE(poll_json, '{}'::jsonb),
    '{until_value}',
    '"completed"'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE poll_json ->> 'until_value' = 'done';
