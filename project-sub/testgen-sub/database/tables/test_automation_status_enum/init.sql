CREATE TABLE IF NOT EXISTS test_automation_status_enum (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  automation_status_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  description TEXT
);

INSERT INTO test_automation_status_enum (automation_status_id, name, description) VALUES ('AUTO_EXISTING', '已有自动化', 's0x/smoke/E2E 已覆盖') ON CONFLICT (automation_status_id) DO NOTHING;
INSERT INTO test_automation_status_enum (automation_status_id, name, description) VALUES ('AUTO_PARTIAL', '部分自动化', '部分场景可跑') ON CONFLICT (automation_status_id) DO NOTHING;
INSERT INTO test_automation_status_enum (automation_status_id, name, description) VALUES ('AUTO_TODO', '待建', '尚未脚本化') ON CONFLICT (automation_status_id) DO NOTHING;
INSERT INTO test_automation_status_enum (automation_status_id, name, description) VALUES ('AUTO_MANUAL', '人工', '专家/UAT/代码审查') ON CONFLICT (automation_status_id) DO NOTHING;
