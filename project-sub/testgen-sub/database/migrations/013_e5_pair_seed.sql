-- E5.2：C2-PAYLOAD-001 TS-06-PAIR 种子

UPDATE test_item_detail t
SET
  scheme_primary_id = COALESCE(t.scheme_primary_id, 'TS-06-PAIR'),
  validation_primary_id = COALESCE(t.validation_primary_id, 'VS-03-ZERO')
FROM test_category_minor_scheme cms
WHERE t.item_id = 'C2-PAYLOAD-001'
  AND t.category_minor_id = cms.category_minor_id
  AND t.scheme_primary_id IS NULL;

INSERT INTO ft_run_config (
  item_id,
  scheme_id,
  config_json,
  threshold_json,
  created_at,
  updated_at
)
SELECT
  'C2-PAYLOAD-001',
  'TS-06-PAIR',
  '{
    "pairs": [
      {
        "role": "coach",
        "path": "/health",
        "method": "GET",
        "expect_status": 200,
        "forbidden_patterns": ["INTERNAL_ERROR", "stack trace", "password"]
      },
      {
        "role": "member",
        "path": "/health",
        "method": "GET",
        "expect_status": 200,
        "forbidden_patterns": ["INTERNAL_ERROR", "stack trace", "password"]
      },
      {
        "role": "manager",
        "path": "/health",
        "method": "GET",
        "expect_status": 200,
        "forbidden_patterns": ["INTERNAL_ERROR", "stack trace", "password"]
      }
    ]
  }'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ft_run_config
  WHERE item_id = 'C2-PAYLOAD-001' AND scheme_id = 'TS-06-PAIR'
);
