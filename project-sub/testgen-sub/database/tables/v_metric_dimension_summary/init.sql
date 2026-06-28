-- 维度指标汇总
CREATE OR REPLACE VIEW v_metric_dimension_summary AS
SELECT d.dimension_id, d.name AS dimension_name, d.item_count AS total_items,
  ROUND(100.0 * d.item_count / NULLIF((SELECT COUNT(*) FROM test_item_detail WHERE is_active), 0), 2) AS pct_of_all,
  COUNT(*) FILTER (WHERE t.priority_id = 'P0') AS p0_count,
  COUNT(*) FILTER (WHERE t.is_p0_blocker) AS p0_blocker_count,
  COUNT(*) FILTER (WHERE t.is_risk_flag) AS risk_item_count,
  COUNT(*) FILTER (WHERE t.automation_status_id = 'AUTO_EXISTING') AS auto_existing_count,
  COUNT(*) FILTER (WHERE t.automation_status_id = 'AUTO_TODO') AS auto_todo_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE t.automation_status_id <> 'AUTO_TODO') / NULLIF(COUNT(*), 0), 2) AS auto_coverage_pct,
  COUNT(*) FILTER (WHERE t.is_observability_audit) AS observability_count
FROM test_dimension d
LEFT JOIN test_item_detail t ON t.dimension_id = d.dimension_id AND t.is_active
GROUP BY d.dimension_id, d.name, d.item_count;;
