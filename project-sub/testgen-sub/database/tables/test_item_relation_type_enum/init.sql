CREATE TABLE IF NOT EXISTS test_item_relation_type_enum (
  relation_type_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  description TEXT
);

INSERT INTO test_item_relation_type_enum (relation_type_id, name, description) VALUES ('GUARD', '防护验证', '主项直接验证该风险不发生或应被阻断') ON CONFLICT (relation_type_id) DO NOTHING;
INSERT INTO test_item_relation_type_enum (relation_type_id, name, description) VALUES ('DETECT', '可观测检测', '日志/journey/字段可检测风险是否发生') ON CONFLICT (relation_type_id) DO NOTHING;
INSERT INTO test_item_relation_type_enum (relation_type_id, name, description) VALUES ('VERIFY', '专项验证', '与风险同主题的非 RISK 前缀专项用例') ON CONFLICT (relation_type_id) DO NOTHING;
INSERT INTO test_item_relation_type_enum (relation_type_id, name, description) VALUES ('SYMPTOM', '症状关联', 'F5 症状与 B 站/接口项关联') ON CONFLICT (relation_type_id) DO NOTHING;
