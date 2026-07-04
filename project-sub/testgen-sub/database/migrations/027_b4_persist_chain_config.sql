-- B4-PERSIST-001 secondary TS-05-CHAIN config (ASCII-only for psql pipe)
UPDATE ft_run_config SET
  config_json = '{"vars":{"coach_id":1,"user_id":10003},"steps":[{"name":"0 create session","runner":"http","method":"POST","path":"/api/sessions","body":{"coach_id":1,"user_id":10003},"expect_status":200,"extract":{"session_id":"$.session_id"}},{"name":"1 submit turn text","runner":"http","method":"POST","path":"/api/chat/turns/submit","body":{"session_id":"{{session_id}}","coach_id":1,"user_id":10003,"message":"hello","client_turn_id":"{{uuid}}"},"expect_status":202,"extract":{"turn_id":"$.turn_id"}},{"name":"2 poll turn","runner":"http","method":"GET","path":"/api/chat/turns/{{turn_id}}","expect_status":200}]}'::jsonb,
  updated_at = NOW()
WHERE item_id = 'B4-PERSIST-001' AND scheme_id = 'TS-05-CHAIN';
