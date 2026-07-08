-- 034: poll 动态终态别名组 — 跨 Agent 兼容 done/completed/success 等

UPDATE ft_api_template
SET
  poll_json = poll_json
    - 'until_value'
    || jsonb_build_object(
      'until_json_path', COALESCE(poll_json -> 'until_json_path', '"$.status"'::jsonb),
      'until_alias_group', 'async_job_success',
      'terminal_fail_alias_group', 'async_job_fail'
    ),
  updated_at = NOW()
WHERE poll_json IS NOT NULL
  AND poll_json != '{}'::jsonb
  AND poll_json ->> 'enabled' IS DISTINCT FROM 'false'
  AND (
    poll_json ->> 'until_value' IN ('done', 'completed', 'success', 'finished')
    OR poll_json ->> 'until_alias_group' IS NULL
  )
  AND (
    url_path ILIKE '%/turns/submit%'
    OR poll_json ->> 'path' ILIKE '%/turns/%'
  );

COMMENT ON COLUMN ft_api_template.poll_json IS
  'submit 后 poll 配置。until_value(单值)|until_values(数组)|until_alias_group(平台别名组)；strict_until=true 关闭自动别名；terminal_fail_* 同理';
