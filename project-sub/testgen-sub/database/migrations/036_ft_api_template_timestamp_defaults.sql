-- 修复 ft_api_template.created_at/updated_at：Sequelize sync 补列后可能 NOT NULL 且无 DEFAULT，导致 021 种子 INSERT 失败

ALTER TABLE ft_api_template
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE ft_api_template
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;
