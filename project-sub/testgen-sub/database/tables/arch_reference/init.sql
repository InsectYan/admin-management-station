CREATE TABLE IF NOT EXISTS arch_reference (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  arch_ref_id VARCHAR(64) PRIMARY KEY,
  station TEXT,
  section TEXT,
  title TEXT
);

INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B1', 'B1', '前端 submit/stream') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B2', 'B2', '门禁 guard') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B3', 'B3', '队列入队 Worker') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B4', 'B4', 'Pipeline prepare/gates/persist') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B5', 'B5', 'Pi outbox/tools') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, station, title) VALUES ('ARCH_B6', 'B6', 'SSE 回传 journey') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S5', '§5', '六站观测指标') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S6', '§6', '同session串行/跨session并行') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S10', '§10', '503/429/症状调参') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S11', '§11', '幂等/可取消/可恢复') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S2', '§2', '多实例 N×W') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_S4', '§4', 'async 主链') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_PI', 'pi-arch', 'Pi 边界') ON CONFLICT (arch_ref_id) DO NOTHING;
INSERT INTO arch_reference (arch_ref_id, section, title) VALUES ('ARCH_REL', 'reliability', '可靠性法则') ON CONFLICT (arch_ref_id) DO NOTHING;
