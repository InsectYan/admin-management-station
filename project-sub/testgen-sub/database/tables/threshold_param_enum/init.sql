CREATE TABLE IF NOT EXISTS threshold_param_enum (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  param_id VARCHAR(64) PRIMARY KEY,
  validation_id VARCHAR(64) REFERENCES test_validation_enum(validation_id),
  name TEXT,
  unit TEXT,
  placeholder TEXT
);

INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('rate_L', 'VS-07-RATE-L', '达标率·低', 'percent', 'rate_L = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('rate_M', 'VS-07-RATE-M', '达标率·中', 'percent', 'rate_M = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('rate_H', 'VS-07-RATE-H', '达标率·高', 'percent', 'rate_H = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('passk_N', 'VS-08-PASSK', '重复次数 N', 'count', 'passk_N = ___') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('passk_M', 'VS-08-PASSK', '至少通过 M', 'count', 'passk_M = ___') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('block_L', 'VS-09-BLOCK-L', '阻断率·低', 'percent', 'block_L = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('block_M', 'VS-09-BLOCK-M', '阻断率·中', 'percent', 'block_M = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('block_H', 'VS-09-BLOCK-H', '阻断率·高', 'percent', 'block_H = ___%') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('submit_p99_ms_L', 'VS-10-SLO-L', 'submit p99·低', 'ms', 'submit_p99_ms_L') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('submit_p99_ms_M', 'VS-10-SLO-M', 'submit p99·中', 'ms', 'submit_p99_ms_M') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('ttft_ms_M', 'VS-10-SLO-M', 'TTFT·中', 'ms', 'ttft_ms_M') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('error_rate_H', 'VS-10-SLO-H', '错误率·高', 'percent', 'error_rate_H') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('reviewer_count', 'VS-11-MAJORITY', '评审人数', 'count', 'reviewer_count') ON CONFLICT (param_id) DO NOTHING;
INSERT INTO threshold_param_enum (param_id, validation_id, name, unit, placeholder) VALUES ('majority_rule', 'VS-11-MAJORITY', '多数规则', 'text', '>50% 合格') ON CONFLICT (param_id) DO NOTHING;
