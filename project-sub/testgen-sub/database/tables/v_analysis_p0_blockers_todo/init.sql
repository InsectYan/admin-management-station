-- P0 阻塞待建
CREATE OR REPLACE VIEW v_analysis_p0_blockers_todo AS
SELECT item_id, item_name, dimension_id, category_major_id,
  scheme_primary_id, validation_primary_id, automation_entry_id, is_risk_flag
FROM test_item_detail
WHERE is_active AND is_p0_blocker AND automation_status_id = 'AUTO_TODO';;
