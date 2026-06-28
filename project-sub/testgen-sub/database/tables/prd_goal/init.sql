CREATE TABLE IF NOT EXISTS prd_goal (
  prd_goal_id VARCHAR(64) PRIMARY KEY,
  goal_no SMALLINT,
  name TEXT,
  primary_dimension TEXT
);

INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G01', 1, '听懂用户想干什么（意图）', 'E,C1') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G02', 2, '找到正确身份、会员、业务对象', 'C1,C3,D3') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G03', 3, '进入正确任务流程', 'C1,C4,B4') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G04', 4, '使用正确上下文', 'E3,C1') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G05', 5, '选择正确回复策略', 'C1,E1') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G06', 6, '遵守权限、状态、安全、确认规则', 'B2,C2,C3,C1') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G07', 7, '返回前端可正确渲染的数据结构', 'C4,D5,G5') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G08', 8, '不在错误端返回不该返回的业务数据', 'C2,C3,C4') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G09', 9, '不重复生成、不重复写库', 'B3,C1,D2') ON CONFLICT (prd_goal_id) DO NOTHING;
INSERT INTO prd_goal (prd_goal_id, goal_no, name, primary_dimension) VALUES ('G10', 10, '关键过程可追踪、可复盘', 'H') ON CONFLICT (prd_goal_id) DO NOTHING;
