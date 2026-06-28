CREATE TABLE IF NOT EXISTS config_env_enum (
  config_env_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  domain TEXT,
  default_value TEXT
);

INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_SESSION_MAX_INFLIGHT', '同 session 在途上限', 'guard', '1') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_COACH_SUBMIT_MAX', '教练 submit 窗口限流', 'guard', '10/window') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_QUEUE_MAX_PENDING', '全店 pending 硬顶', 'queue', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_QUEUE_WARN_PENDING', '排队软提示阈值', 'queue', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_QUEUE_AVG_TURN_SEC', '平均 turn 耗时估算', 'queue', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('DB_CIRCUIT_FAILURE_THRESHOLD', 'DB 熔断失败阈值', 'guard', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('INTERNAL_API_KEY', 'Internal API Key', 'security', '生产必填') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('COACH_TURN_WORKER_CONCURRENCY', 'Worker Pi 并发 W', 'worker', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('COACH_TURN_POLL_MS', 'Worker 抢单轮询', 'worker', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_JOB_STALE_MINUTES', '僵尸 processing 回收', 'worker', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_JOB_RETRY_MAX', 'LLM 失败重试次数', 'worker', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('PG_POOL_MAX', 'RDS 连接池上限', 'infra', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('WORKSPACES_ROOT', 'NAS workspace 根', 'infra', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_STREAM_MAX_WAIT_MS', 'SSE 最长等待', 'sse', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('SSE_HEARTBEAT_MS', 'SSE 心跳间隔', 'sse', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('READY_DELAY_MS', '就绪探针延迟', 'deploy', '5000') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('SHUTDOWN_GRACE_MS', '优雅停机宽限', 'deploy', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_MESSAGE_MAX_LENGTH', '消息最大长度', 'guard', '8000') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_DUPLICATE_MESSAGE_MS', '重复文案窗口', 'guard', '5000') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('BFF_HISTORY_TURNS', 'BFF 历史轮数', 'pipeline', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('TURN_THINKING_APPEND_MS', 'thinking 节流', 'pipeline', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('KNOWLEDGE_SEARCH_LIMIT', '知识库检索 limit', 'pi', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('COACH_MEMORY_WAKE', '记忆 wake 开关', 'memory', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('OTEL_ENABLED', 'OpenTelemetry', 'obs', '0/1') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('DEPLOY_MODE', '部署模式', 'deploy', 'local/agentrun') ON CONFLICT (config_env_id) DO NOTHING;
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES ('CORS_ORIGIN', 'CORS 域名', 'shell', '项目配置') ON CONFLICT (config_env_id) DO NOTHING;
