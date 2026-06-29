-- E2：C2-BOUND-004 样本集种子 + run_config（3× GET /health HTTP smoke）

DO $$
DECLARE
  v_set_id INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ft_sample_set WHERE name = 'C2-BOUND-004 E2 smoke'
  ) THEN
    INSERT INTO ft_sample_set (name, tags, item_id, sample_count, created_at, updated_at)
    VALUES (
      'C2-BOUND-004 E2 smoke',
      '["e2","health","C2-BOUND-004"]'::jsonb,
      'C2-BOUND-004',
      3,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_set_id;

    INSERT INTO ft_sample_item (sample_set_id, input_data, metadata, sort_order, created_at)
    VALUES
      (v_set_id, '{"runner":"http","path":"/health","method":"GET","expect_status":200}'::jsonb, '{"label":"health-1"}'::jsonb, 0, NOW()),
      (v_set_id, '{"runner":"http","path":"/health","method":"GET","expect_status":200}'::jsonb, '{"label":"health-2"}'::jsonb, 1, NOW()),
      (v_set_id, '{"runner":"http","path":"/health","method":"GET","expect_status":200}'::jsonb, '{"label":"health-3"}'::jsonb, 2, NOW());
  ELSE
    SELECT id INTO v_set_id FROM ft_sample_set WHERE name = 'C2-BOUND-004 E2 smoke' LIMIT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'C2-BOUND-004' AND scheme_id = 'TS-04-SET'
  ) THEN
    INSERT INTO ft_run_config (
      item_id,
      scheme_id,
      config_json,
      threshold_json,
      sample_set_id,
      created_at,
      updated_at
    )
    VALUES (
      'C2-BOUND-004',
      'TS-04-SET',
      '{}'::jsonb,
      '{"rate_M": 100}'::jsonb,
      v_set_id,
      NOW(),
      NOW()
    );
  END IF;
END $$;
