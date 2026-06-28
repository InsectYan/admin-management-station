CREATE TABLE IF NOT EXISTS test_category_minor_scheme (
  category_minor_id VARCHAR(64) PRIMARY KEY REFERENCES test_category_minor(category_minor_id),
  item_prefix VARCHAR(64) NOT NULL,
  scheme_primary_id VARCHAR(16) REFERENCES test_scheme_enum(scheme_id),
  scheme_secondary_id VARCHAR(16) REFERENCES test_scheme_enum(scheme_id),
  validation_primary_id VARCHAR(20) REFERENCES test_validation_enum(validation_id),
  validation_secondary_id VARCHAR(20) REFERENCES test_validation_enum(validation_id),
  sample_execution_note TEXT,
  mapping_source VARCHAR(128) DEFAULT 'scheme-map.json'
);

CREATE INDEX IF NOT EXISTS idx_category_minor_scheme_prefix ON test_category_minor_scheme(item_prefix);
