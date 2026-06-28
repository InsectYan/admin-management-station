CREATE TABLE IF NOT EXISTS test_validation_enum (
  validation_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  validation_group TEXT,
  rate_level TEXT,
  block_level TEXT,
  slo_level TEXT,
  description TEXT
);

INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-01-EXACT', '精确匹配', 'DETERMINISTIC', '单次可判：HTTP 码、错误文案') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-02-CONTRACT', '契约通过', 'DETERMINISTIC', 'schema/validator/outbox/gates') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-03-ZERO', '零违规', 'DETERMINISTIC', '禁止项不得出现') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-04-CHAIN-OK', '链路全过', 'DETERMINISTIC', '多步方案每步满足') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-05-PRESENCE', '存在性', 'OBSERVABILITY', '字段/日志/event 存在') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-06-COMPLETE', '完整性', 'OBSERVABILITY', '结构齐全无缺失') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, rate_level, description) VALUES ('VS-07-RATE-L', '达标率·低门槛', 'STATISTICAL', 'L', '样本通过率≥L阈值') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, rate_level, description) VALUES ('VS-07-RATE-M', '达标率·中门槛', 'STATISTICAL', 'M', '样本通过率≥M阈值') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, rate_level, description) VALUES ('VS-07-RATE-H', '达标率·高门槛', 'STATISTICAL', 'H', '样本通过率≥H阈值') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-08-PASSK', 'Pass^k稳定', 'STATISTICAL', 'N次重复至少M次满足') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, block_level, description) VALUES ('VS-09-BLOCK-L', '安全阻断·低', 'STATISTICAL', 'L', '对抗集低比例阻断') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, block_level, description) VALUES ('VS-09-BLOCK-M', '安全阻断·中', 'STATISTICAL', 'M', '对抗集中比例阻断') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, block_level, description) VALUES ('VS-09-BLOCK-H', '安全阻断·高', 'STATISTICAL', 'H', '对抗集高比例或全部阻断') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, slo_level, description) VALUES ('VS-10-SLO-L', '性能SLO·低', 'SLO', 'L', 'p99/TTFT L档') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, slo_level, description) VALUES ('VS-10-SLO-M', '性能SLO·中', 'SLO', 'M', 'p99/TTFT M档') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, slo_level, description) VALUES ('VS-10-SLO-H', '性能SLO·高', 'SLO', 'H', 'p99/TTFT H档') ON CONFLICT (validation_id) DO NOTHING;
INSERT INTO test_validation_enum (validation_id, name, validation_group, description) VALUES ('VS-11-MAJORITY', '人工多数', 'MANUAL', '评审员多数合格') ON CONFLICT (validation_id) DO NOTHING;
