-- 自动化状态分布
CREATE OR REPLACE VIEW v_metric_automation_coverage AS
SELECT a.automation_status_id, a.name AS status_name,
  COUNT(t.item_id) AS item_count,
  ROUND(100.0 * COUNT(t.item_id) / NULLIF((SELECT COUNT(*) FROM test_item_detail WHERE is_active), 0), 2) AS pct_of_all
FROM test_automation_status_enum a
LEFT JOIN test_item_detail t ON t.automation_status_id = a.automation_status_id AND t.is_active
GROUP BY a.automation_status_id, a.name;;
