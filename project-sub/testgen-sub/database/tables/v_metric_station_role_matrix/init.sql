-- 六站×三端矩阵
CREATE OR REPLACE VIEW v_metric_station_role_matrix AS
SELECT station_id, role_scope_id, COUNT(*) AS item_count
FROM test_item_detail WHERE is_active
GROUP BY station_id, role_scope_id;;
