-- 优先级分布
CREATE OR REPLACE VIEW v_metric_priority_distribution AS
SELECT p.priority_id, p.name AS priority_name,
  COUNT(t.item_id) AS item_count,
  ROUND(100.0 * COUNT(t.item_id) / NULLIF((SELECT COUNT(*) FROM test_item_detail WHERE is_active), 0), 2) AS pct_of_all
FROM test_priority_enum p
LEFT JOIN test_item_detail t ON t.priority_id = p.priority_id AND t.is_active
GROUP BY p.priority_id, p.name, p.sort_order
ORDER BY p.sort_order;;
