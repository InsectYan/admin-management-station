-- 发版就绪分析
CREATE OR REPLACE VIEW v_analysis_release_readiness AS
SELECT
  (SELECT COUNT(*) FROM test_item_detail WHERE is_active) AS total_items,
  (SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker) AS p0_total,
  (SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker AND automation_status_id = 'AUTO_TODO') AS p0_auto_todo,
  ROUND(100.0 * (SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker AND automation_status_id = 'AUTO_TODO')
    / NULLIF((SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker), 0), 2) AS p0_auto_todo_pct,
  (SELECT COUNT(DISTINCT risk_item_id) FROM test_item_risk_link) AS risk_total,
  (SELECT COUNT(*) FROM v_metric_risk_guard_coverage WHERE coverage_status = 'GAP') AS risk_gap_count,
  (SELECT COUNT(*) FROM v_metric_risk_guard_coverage WHERE coverage_status = 'PARTIAL') AS risk_partial_count,
  (SELECT COUNT(*) FROM v_metric_risk_guard_coverage WHERE coverage_status = 'COVERED') AS risk_covered_count,
  (SELECT COUNT(*) FROM v_metric_prd_goal_coverage WHERE coverage_note = 'LOW') AS prd_goal_low_count,
  (SELECT COUNT(*) FROM v_metric_prd_goal_coverage WHERE coverage_note = 'GAP') AS prd_goal_gap_count,
  CASE WHEN (SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker AND automation_status_id = 'AUTO_TODO') = 0
         AND (SELECT COUNT(*) FROM v_metric_risk_guard_coverage WHERE coverage_status = 'GAP') = 0 THEN 'GREEN'
       WHEN (SELECT COUNT(*) FROM test_item_detail WHERE is_active AND is_p0_blocker AND automation_status_id = 'AUTO_TODO') <= 5
         AND (SELECT COUNT(*) FROM v_metric_risk_guard_coverage WHERE coverage_status = 'GAP') = 0 THEN 'YELLOW'
       ELSE 'RED' END AS release_signal;;
