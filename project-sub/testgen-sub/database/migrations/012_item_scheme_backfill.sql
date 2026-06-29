-- 回填 test_item_detail 缺失的主/辅 TS/VS（init.sql 种子未写入 scheme 列，data.json 已有值）

UPDATE test_item_detail t
SET
  scheme_primary_id = cms.scheme_primary_id,
  scheme_secondary_id = COALESCE(t.scheme_secondary_id, cms.scheme_secondary_id),
  validation_primary_id = cms.validation_primary_id,
  validation_secondary_id = COALESCE(t.validation_secondary_id, cms.validation_secondary_id),
  sample_execution_note = COALESCE(t.sample_execution_note, cms.sample_execution_note),
  scheme_mapping_source = COALESCE(t.scheme_mapping_source, cms.mapping_source)
FROM test_category_minor_scheme cms
WHERE t.category_minor_id = cms.category_minor_id
  AND t.scheme_primary_id IS NULL;
