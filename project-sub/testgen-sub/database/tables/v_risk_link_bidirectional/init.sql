-- 风险双向关联
CREATE OR REPLACE VIEW v_risk_link_bidirectional AS
SELECT 'RISK_TO_MAIN' AS direction, risk_item_id AS source_item_id, main_item_id AS target_item_id,
  relation_type_id, risk_category, is_primary, description, link_id
FROM test_item_risk_link
UNION ALL
SELECT 'MAIN_TO_RISK' AS direction, main_item_id AS source_item_id, risk_item_id AS target_item_id,
  relation_type_id, risk_category, is_primary, '反向：' || description, link_id
FROM test_item_risk_link;;
