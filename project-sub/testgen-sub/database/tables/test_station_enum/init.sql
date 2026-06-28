CREATE TABLE IF NOT EXISTS test_station_enum (
  station_id VARCHAR(64) PRIMARY KEY,
  station_no TEXT,
  name TEXT,
  description TEXT,
  arch_ref_id VARCHAR(64)
);

INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('NONE', 0, '非站级/横切', '业务/Agent/部署类', NULL) ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S01', 1, '① 前端', 'submit/stream/SSE/resume', 'ARCH_B1') ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S02', 2, '② 门禁', 'Key/熔断/限流/在途', 'ARCH_B2') ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S03', 3, '③ 队列', 'turn_jobs 入队 Worker', 'ARCH_B3') ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S04', 4, '④ Pipeline', 'prepare/gates/persist', 'ARCH_B4') ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S05', 5, '⑤ Pi', 'LLM/tools/outbox', 'ARCH_B5') ON CONFLICT (station_id) DO NOTHING;
INSERT INTO test_station_enum (station_id, station_no, name, description, arch_ref_id) VALUES ('S06', 6, '⑥ 回传', 'SSE final/journey', 'ARCH_B6') ON CONFLICT (station_id) DO NOTHING;
