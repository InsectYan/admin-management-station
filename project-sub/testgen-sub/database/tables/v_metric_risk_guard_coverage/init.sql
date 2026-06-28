-- 风险防护覆盖
CREATE OR REPLACE VIEW v_metric_risk_guard_coverage AS
SELECT r.risk_item_id, t.item_name AS risk_name, r.risk_category, t.priority_id,
  COUNT(*) AS guard_link_count,
  COUNT(*) FILTER (WHERE r.is_primary AND r.relation_type_id = 'GUARD') AS primary_guard_count,
  (COUNT(*) FILTER (WHERE r.is_primary AND r.relation_type_id = 'GUARD') > 0) AS has_primary_guard,
  CASE WHEN COUNT(*) FILTER (WHERE r.is_primary AND r.relation_type_id = 'GUARD') > 0 THEN 'COVERED'
       WHEN COUNT(*) > 0 THEN 'PARTIAL' ELSE 'GAP' END AS coverage_status
FROM test_item_risk_link r
JOIN test_item_detail t ON t.item_id = r.risk_item_id
GROUP BY r.risk_item_id, t.item_name, r.risk_category, t.priority_id;;
