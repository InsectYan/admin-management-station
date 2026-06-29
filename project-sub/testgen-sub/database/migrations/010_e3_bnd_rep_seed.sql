-- E3：B4-MEM-001 TS-02-BND 矩阵种子（3× GET /health HTTP smoke）
-- 附：E4-STAB-001 TS-03-REP 重复种子（便于 Pass^k 联调）

DO $$
DECLARE
  v_health_row JSONB := '{"runner":"http","path":"/health","method":"GET","expect_status":200}'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'B4-MEM-001' AND scheme_id = 'TS-02-BND'
  ) THEN
    INSERT INTO ft_run_config (
      item_id,
      scheme_id,
      config_json,
      threshold_json,
      created_at,
      updated_at
    )
    VALUES (
      'B4-MEM-001',
      'TS-02-BND',
      jsonb_build_object(
        'matrix',
        jsonb_build_array(v_health_row, v_health_row, v_health_row)
      ),
      '{}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'E4-STAB-001' AND scheme_id = 'TS-03-REP'
  ) THEN
    INSERT INTO ft_run_config (
      item_id,
      scheme_id,
      config_json,
      threshold_json,
      created_at,
      updated_at
    )
    VALUES (
      'E4-STAB-001',
      'TS-03-REP',
      jsonb_build_object(
        'repeat_count', 3,
        'runner', 'http',
        'path', '/health',
        'method', 'GET',
        'expect_status', 200
      ),
      '{"passk_N": 3, "passk_M": 3}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;
END $$;
