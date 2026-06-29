-- E4：B6-HB-001 TS-05-CHAIN + C3-ALERT-001 TS-08-OBS 种子

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'B6-HB-001' AND scheme_id = 'TS-05-CHAIN'
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
      'B6-HB-001',
      'TS-05-CHAIN',
      '{
        "steps": [
          {"runner":"http","path":"/health","method":"GET","expect_status":200,"extract":{"runtime":"runtime"}},
          {"runner":"http","path":"/","method":"GET","expect_status":200},
          {"runner":"http","path":"/health","method":"GET","expect_status":200}
        ]
      }'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ft_run_config
    WHERE item_id = 'C3-ALERT-001' AND scheme_id = 'TS-08-OBS'
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
      'C3-ALERT-001',
      'TS-08-OBS',
      '{
        "checks": [
          {
            "mode": "http_fields",
            "path": "/health",
            "method": "GET",
            "expect_status": 200,
            "required_fields": ["status", "runtime", "database", "migrations"]
          },
          {
            "mode": "journey_list",
            "limit": 5,
            "required_fields": ["total", "journeys"]
          }
        ]
      }'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    );
  END IF;
END $$;
