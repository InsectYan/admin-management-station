-- E5 修正：C1-SAFE-001 主方案为 TS-04-SET，对抗验收改用 E5-INJ-001

UPDATE test_plan_item pi
SET item_id = 'E5-INJ-001'
FROM test_plan p
WHERE pi.plan_id = p.id
  AND p.name = 'E5 自动化回归'
  AND pi.item_id = 'C1-SAFE-001';

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
  fc.config_json,
  fc.threshold_json,
  NOW(),
  NOW()
FROM ft_run_config fc
WHERE fc.item_id = 'C1-SAFE-001'
  AND fc.scheme_id = 'TS-07-NEG'
  AND NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'E5-INJ-001' AND scheme_id = 'TS-07-NEG'
  );

DELETE FROM ft_run_config
WHERE item_id = 'C1-SAFE-001' AND scheme_id = 'TS-07-NEG';
