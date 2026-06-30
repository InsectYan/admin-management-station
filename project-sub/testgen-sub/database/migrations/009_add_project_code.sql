-- 为已有 Fitness 主表补 project_code 列（schemaSync 亦会从 init.sql 自动 ADD COLUMN）

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'test_dimension','test_category_major','test_category_minor','test_scheme_enum',
    'test_validation_enum','test_category_minor_scheme','test_scheme_validation_pair',
    'test_priority_enum','test_automation_status_enum','test_station_enum','test_role_enum',
    'config_env_enum','automation_entry_enum','test_exec_env_enum','test_env_tier_enum',
    'threshold_param_enum','prd_goal','prd_reference','arch_reference',
    'test_item_prefix_scheme','test_item_relation_type_enum','test_item_detail',
    'test_item_prd_goal_link','test_item_prd_ref_link','test_item_arch_ref_link','test_item_risk_link'
  ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS project_code VARCHAR(64) NOT NULL DEFAULT %L',
      tbl, 'fitness-agent'
    );
  END LOOP;
END $$;
