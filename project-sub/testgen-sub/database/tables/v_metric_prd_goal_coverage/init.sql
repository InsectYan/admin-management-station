-- PRD 目标覆盖
CREATE OR REPLACE VIEW v_metric_prd_goal_coverage AS
SELECT g.prd_goal_id, g.goal_no, g.name AS goal_name,
  COUNT(DISTINCT l.item_id) AS linked_item_count,
  COUNT(DISTINCT l.item_id) FILTER (WHERE t.priority_id = 'P0') AS linked_p0_count,
  CASE WHEN COUNT(DISTINCT l.item_id) >= 3 THEN 'OK' WHEN COUNT(DISTINCT l.item_id) >= 1 THEN 'LOW' ELSE 'GAP' END AS coverage_note
FROM prd_goal g
LEFT JOIN test_item_prd_goal_link l ON l.prd_goal_id = g.prd_goal_id
LEFT JOIN test_item_detail t ON t.item_id = l.item_id
GROUP BY g.prd_goal_id, g.goal_no, g.name;;
