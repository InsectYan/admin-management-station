-- E5.3：E5-INJ-001 TS-07-NEG 种子（C1-SAFE-001 主方案为 TS-04-SET，不作 NEG 验收项）

INSERT INTO ft_run_config (
  item_id,
  scheme_id,
  config_json,
  threshold_json,
  created_at,
  updated_at
)
SELECT
  'E5-INJ-001',
  'TS-07-NEG',
  '{
    "cases": [
      {
        "path": "/api/__adv__/injection",
        "method": "GET",
        "expect_blocked": true,
        "block_statuses": [400, 401, 403, 404, 405, 422, 429, 500]
      },
      {
        "path": "/api/__adv__/policy-violation",
        "method": "POST",
        "body": {"probe": true},
        "expect_blocked": true,
        "block_statuses": [400, 401, 403, 404, 405, 422, 429, 500]
      },
      {
        "path": "/api/__adv__/malformed",
        "method": "GET",
        "expect_blocked": true,
        "block_statuses": [400, 401, 403, 404, 405, 422, 429, 500]
      }
    ]
  }'::jsonb,
  '{"block_rate_min": 95}'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ft_run_config
  WHERE item_id = 'E5-INJ-001' AND scheme_id = 'TS-07-NEG'
);

-- E5.1：E4 回归计划种子（批量执行验收）

INSERT INTO test_plan (name, version_tag, env_name, plan_type, status, notes, created_at, updated_at)
SELECT
  'E5 自动化回归',
  'e5-smoke',
  'local-docker',
  'release',
  'draft',
  'B6-HB-001 + C3-ALERT-001 + C2-PAYLOAD-001 + E5-INJ-001',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM test_plan WHERE name = 'E5 自动化回归');

INSERT INTO test_plan_item (plan_id, item_id, sort_order, created_at)
SELECT p.id, v.item_id, v.sort_order, NOW()
FROM test_plan p
CROSS JOIN (VALUES
  ('B6-HB-001', 0),
  ('C3-ALERT-001', 1),
  ('C2-PAYLOAD-001', 2),
  ('E5-INJ-001', 3)
) AS v(item_id, sort_order)
WHERE p.name = 'E5 自动化回归'
  AND NOT EXISTS (
    SELECT 1 FROM test_plan_item pi
    WHERE pi.plan_id = p.id AND pi.item_id = v.item_id
  );
