CREATE TABLE IF NOT EXISTS test_category_major (
  category_major_id VARCHAR(64) PRIMARY KEY,
  dimension_id VARCHAR(64) REFERENCES test_dimension(dimension_id),
  name TEXT,
  description TEXT,
  item_count TEXT,
  default_scheme_id VARCHAR(64)
);

INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A1', 'A', '单元/契约', 'outbox、memory_ops、gates 纯函数', 7, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A2', 'A', '站级集成', 's02–s06 + Postgres', 6, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A3', 'A', 'HTTP/服务', 'submit/stream/探针', 0, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A4', 'A', '全栈 E2E', 'smoke/resume/coach/consultation/chain/session', 0, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A5', 'A', '压测/运维', '多实例、容量、smoke.sh', 3, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('A6', 'A', 'Eval/UAT', 'Golden、专家安全验收', 3, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B1', 'B', '① 前端', '幂等、SSE、resume、queue_meta UX', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B2', 'B', '② 门禁', 'Key、熔断、在途、限流、队列硬顶', 10, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B3', 'B', '③ 队列', '幂等、claim、cancel、retry、stale', 8, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B4', 'B', '④ Pipeline', 'prepare、gates、persist、状态机', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B5', 'B', '⑤ Pi', 'outbox 契约、tools、NAS 锁', 4, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B6', 'B', '⑥ 回传', 'SSE、journey、TTFT', 6, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('B_REL', 'B', '可靠性法则', '幂等/串行/并行/可取消/可恢复', 0, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('C1', 'C', '教练端业务', 'PRD §4.1–4.12', 65, 'TS-05-CHAIN') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('C2', 'C', '会员端业务', 'PRD §5.1–5.13', 38, 'TS-05-CHAIN') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('C3', 'C', '管理端业务', 'PRD §6.1–6.13', 30, 'TS-05-CHAIN') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('C4', 'C', '横切业务与状态机', 'PRD §7.1–7.3', 14, 'TS-05-CHAIN') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('D1', 'D', '接口正常路径', '三端 submit/stream/cancel/config/探针', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('D2', 'D', '接口异常/错误码', '入参/错误码/幂等/SSE schema', 9, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('D3', 'D', '套壳联调', 'JWT、Internal Key、内网、CORS', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('D4', 'D', '202 载荷字段', 'submit 202 响应字段契约', 4, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('D5', 'D', 'SSE 事件类型', 'status/thinking/trace/message/done', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E1', 'E', '决策与路径', '意图、风险优先', 5, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E2', 'E', '工具调用', 'tool 选择/参数/只读', 4, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E3', 'E', '记忆与上下文', '跨轮记忆、session 隔离', 4, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E4', 'E', '稳定性', 'LLM 失败、长跑 stream', 3, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E5', 'E', '安全与合规', '注入、医疗、隐私', 5, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E6', 'E', 'Eval/CI', 'Golden/Mock/Judge', 4, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E_RISK', 'E', 'Agent高风险清单', 'PRD §8 十条', 10, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('E_SKILL', 'E', 'Skill路由', 'workspace-templates skill 对照', 5, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F1', 'F', '性能', 'submit 延迟、TTFT、C_pi', 6, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F2', 'F', '可靠性', '多实例、stale、drain、RDS/NAS', 4, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F3', 'F', '可观测概要', 'SLS、OTel（详见 H）', 4, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F4', 'F', '部署与环境', 'local/AgentRun', 4, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F5', 'F', '症状→测试', '架构 §10 调参', 9, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('F6', 'F', '容量公式', 'C_pi、RDS、T_queue', 3, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G1', 'G', '等待与阶段反馈', 'PRD §4.12 status 文案', 7, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G2', 'G', '排队感知', 'queue_meta/503/429', 3, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G3', 'G', '错误友好', '中文错误+写库说明', 3, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G4', 'G', '会话与续传', 'resumeStream', 4, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G5', 'G', '结构化 UI', 'plan_form/require_form 组件', 4, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G6', 'G', '三端差异', 'coach/member/manager UX', 3, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G7', 'G', '流式与半截内容', 'SSE 中断不写档', 2, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('G8', 'G', '耗时体验指标', 'PRD §4.12 时间节点', 5, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H1', 'H', '六站观测指标', '架构图 §5', 9, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H2', 'H', 'PRD 日志字段', '§7.3 十九项', 19, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H3', 'H', '会员端专用日志', 'PRD §5.11', 3, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H4', 'H', '管理端专用日志', 'PRD §6.10', 3, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H5', 'H', 'turn_journeys', '六站漫游', 3, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H6', 'H', 'SLS/接口监控', 'api_label_zh/trace_id', 3, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H7', 'H', '排障速查', 'pi-ops 成熟度', 6, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('H8', 'H', '可观测缺口', 'token/Prometheus/DLQ', 4, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
