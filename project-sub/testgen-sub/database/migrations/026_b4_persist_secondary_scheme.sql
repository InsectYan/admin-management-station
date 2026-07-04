-- B4-PERSIST-001：主方案 TS-02-BND 矩阵 + 辅方案 TS-05-CHAIN E2E 串联
UPDATE test_item_detail SET
  scheme_secondary_id = 'TS-05-CHAIN',
  validation_secondary_id = 'VS-04-CHAIN-OK',
  updated_at = NOW()
WHERE item_id = 'B4-PERSIST-001' AND is_active = TRUE;
