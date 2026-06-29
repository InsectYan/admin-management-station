-- 去重计划用例（E5 迁移修正 item_id 时可能产生重复行）

DELETE FROM test_plan_item_result r
USING test_plan_item pi
WHERE r.plan_item_id = pi.id
  AND pi.id IN (
    SELECT a.id
    FROM test_plan_item a
    JOIN test_plan_item b
      ON a.plan_id = b.plan_id AND a.item_id = b.item_id AND a.id > b.id
  );

DELETE FROM test_plan_item a
USING test_plan_item b
WHERE a.plan_id = b.plan_id
  AND a.item_id = b.item_id
  AND a.id > b.id;
