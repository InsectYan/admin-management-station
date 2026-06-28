CREATE TABLE IF NOT EXISTS automation_entry_enum (
  automation_entry_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  command TEXT,
  suite TEXT
);

INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S02', 's02 门禁站测', 'cd server && npm run test:stations -- s02', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S03', 's03 队列站测', 'cd server && npm run test:stations -- s03', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S04_MACRO', 's04 macro gate', 'cd server && npm run test:stations -- s04-macro', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S04_SESSION', 's04 session gate', 'cd server && npm run test:stations -- s04-session', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S04_BFF', 's04 bff', 'cd server && npm run test:stations -- s04-bff', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S05', 's05 Pi 契约', 'cd server && npm run test:stations -- s05', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_S06', 's06 journey', 'cd server && npm run test:stations -- s06', 'stations') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_SMOKE', 'E2E smoke', 'cd server && npm run test:e2e -- smoke', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_CHAIN', 'E2E chain', 'cd server && npm run test:e2e -- chain', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_SESSION', 'E2E session', 'cd server && npm run test:e2e -- session', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_RESUME', 'E2E resume', 'cd server && npm run test:e2e -- resume', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_CONSULT', 'E2E consultation', 'cd server && npm run test:e2e -- consultation', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_COACH', 'E2E coach', 'cd server && npm run test:e2e -- coach', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_E2E_GENERIC', 'E2E 通用', 'cd server && npm run test:e2e', 'e2e') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_LOCAL_STACK', 'local 全栈', 'fitness local', 'deploy') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_AGENTRUN', 'AgentRun smoke', './scripts/smoke.sh', 'deploy') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_CODE_REVIEW', '类型检查+审查', 'npm run typecheck', 'ci') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_ARCH_REVIEW', '架构审查', '架构审查清单', 'manual') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_MANUAL_UAT', '专家 UAT', '人工 rubric 评审', 'manual') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_MANUAL', '人工测试', NULL, 'manual') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_RDS_QUERY', 'RDS 查询', 'SQL turn_jobs/连接数', 'ops') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_SLS', 'SLS 聚合', 'SLS api_label_zh', 'ops') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_OTEL', 'OTel trace', 'ARMS/OTEL 控制台', 'ops') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_OPS', '运维操作', 'pi-ops 手册', 'ops') ON CONFLICT (automation_entry_id) DO NOTHING;
INSERT INTO automation_entry_enum (automation_entry_id, name, command, suite) VALUES ('AUTO_TODO_SCRIPT', '待建脚本', NULL, 'todo') ON CONFLICT (automation_entry_id) DO NOTHING;
