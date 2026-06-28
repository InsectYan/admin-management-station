CREATE TABLE IF NOT EXISTS test_role_enum (
  role_scope_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  description TEXT
);

INSERT INTO test_role_enum (role_scope_id, name, description) VALUES ('COACH', '教练端', '核心 Agent 主链') ON CONFLICT (role_scope_id) DO NOTHING;
INSERT INTO test_role_enum (role_scope_id, name, description) VALUES ('MEMBER', '会员端', '轻问答+确认/反馈') ON CONFLICT (role_scope_id) DO NOTHING;
INSERT INTO test_role_enum (role_scope_id, name, description) VALUES ('MANAGER', '管理端', '查询+分配') ON CONFLICT (role_scope_id) DO NOTHING;
INSERT INTO test_role_enum (role_scope_id, name, description) VALUES ('ALL', '三端/横切', '多端对照或通用') ON CONFLICT (role_scope_id) DO NOTHING;
INSERT INTO test_role_enum (role_scope_id, name, description) VALUES ('SYSTEM', '系统/探针', 'health/ready/infra') ON CONFLICT (role_scope_id) DO NOTHING;
