-- 配置模板实例表（每模板一张，item_id 关联 test_item_detail）
-- 020: 在 Fitness 基表 seed 之后执行

CREATE TABLE IF NOT EXISTS tpl_config_det (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_bnd (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_rep (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_set (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  sample_set_id INT,
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_chain (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_pair (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_neg (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_obs (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_load (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tpl_config_man (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE test_item_detail
  ADD COLUMN IF NOT EXISTS template_code VARCHAR(32) REFERENCES config_template_enum(template_code);

CREATE INDEX IF NOT EXISTS idx_test_item_detail_template_code ON test_item_detail(template_code);

UPDATE test_item_detail i
SET template_code = m.template_code
FROM test_category_major_template m
WHERE i.category_major_id = m.category_major_id
  AND (i.template_code IS NULL OR i.template_code = '');

UPDATE test_item_detail i
SET template_code = t.template_code
FROM config_template_enum t
WHERE i.category_major_id IN ('C1', 'C2', 'C3', 'C4')
  AND i.scheme_primary_id = t.scheme_id
  AND (i.template_code IS NULL OR i.template_code = '');
