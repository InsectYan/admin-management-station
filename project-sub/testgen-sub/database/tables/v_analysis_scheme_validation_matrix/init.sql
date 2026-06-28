-- TS×VS 方案矩阵
CREATE OR REPLACE VIEW v_analysis_scheme_validation_matrix AS
SELECT t.scheme_primary_id AS scheme_id, s.name AS scheme_name,
  t.validation_primary_id AS validation_id, v.name AS validation_name,
  COUNT(*) AS item_count
FROM test_item_detail t
JOIN test_scheme_enum s ON s.scheme_id = t.scheme_primary_id
JOIN test_validation_enum v ON v.validation_id = t.validation_primary_id
WHERE t.is_active
GROUP BY t.scheme_primary_id, s.name, t.validation_primary_id, v.name;;
