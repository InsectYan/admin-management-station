-- 维度自动化就绪
CREATE OR REPLACE VIEW v_analysis_dimension_automation AS
SELECT dimension_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE automation_status_id = 'AUTO_EXISTING') AS existing,
  COUNT(*) FILTER (WHERE automation_status_id = 'AUTO_PARTIAL') AS partial,
  COUNT(*) FILTER (WHERE automation_status_id = 'AUTO_TODO') AS todo,
  COUNT(*) FILTER (WHERE automation_status_id = 'AUTO_MANUAL') AS manual,
  ROUND(100.0 * COUNT(*) FILTER (WHERE automation_status_id <> 'AUTO_TODO') / NULLIF(COUNT(*), 0), 2) AS automation_ready_pct
FROM test_item_detail WHERE is_active GROUP BY dimension_id;;
