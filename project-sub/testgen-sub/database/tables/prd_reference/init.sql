CREATE TABLE IF NOT EXISTS prd_reference (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  prd_ref_id VARCHAR(64) PRIMARY KEY,
  section TEXT,
  title TEXT
);

INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_2', '§2', '三端定位') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_1', '§4.1', '教练入口与会员上下文') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_2', '§4.2', '意图识别') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_3', '§4.3', '生成类对象清单') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_4', '§4.4', '训练计划生成') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_5', '§4.5', '单次训练内容') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_6', '§4.6', '训练总结') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_7', '§4.7', '回复策略') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_8', '§4.8', '安全审查') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_9', '§4.9', 'AI影响分析') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_10', '§4.10', '写库确认') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_11', '§4.11', '删除与幂等') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_4_12', '§4.12', '速度与阶段反馈') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_1', '§5.1–5.2', '会员能力边界') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_6', '§5.6', '会员反馈') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_7', '§5.7', '会员医疗安全') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_8', '§5.8', '会员载荷边界') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_9', '§5.9', '健康问卷') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_10', '§5.10', '会员速度与异常') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_11', '§5.11', '会员专用日志') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_12', '§5.12', '会员高风险清单') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_5_13', '§5.13', '会员验收口径') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_1', '§6.1', '管理能力矩阵') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_3', '§6.3', '管理查询场景') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_6', '§6.6', '管理提醒') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_7', '§6.7', '管理载荷边界') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_8', '§6.8–6.9', '权限与消歧') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_10', '§6.10', '管理专用日志') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_12', '§6.12', '管理高风险清单') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_13', '§6.13', '管理验收口径') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_7_1', '§7.1', '三端载荷矩阵') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_7_2', '§7.2', '业务状态机') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_7_3', '§7.3', '必查日志字段') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_7_PAYLOAD', '§7', '载荷契约') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_8', '§8', 'Agent高风险误判') ON CONFLICT (prd_ref_id) DO NOTHING;
INSERT INTO prd_reference (prd_ref_id, section, title) VALUES ('PRD_6_PERM', '§6', '管理端权限') ON CONFLICT (prd_ref_id) DO NOTHING;
