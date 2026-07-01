CREATE TABLE IF NOT EXISTS config_template_enum (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  template_code VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scheme_id VARCHAR(16) NOT NULL REFERENCES test_scheme_enum(scheme_id),
  panel_key VARCHAR(16) NOT NULL,
  table_name VARCHAR(64) NOT NULL,
  agent_skill VARCHAR(64),
  agent_action VARCHAR(64),
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO config_template_enum (template_code, name, description, scheme_id, panel_key, table_name, agent_skill, agent_action, sort_order) VALUES
  ('TPL-DET', '确定性单次', 'HTTP/CLI 单次请求与精确断言', 'TS-01-DET', 'det', 'tpl_config_det', 'fitness-config-skill', 'generate_det', 1),
  ('TPL-BND', '边界矩阵', '入参边界与状态机矩阵逐行执行', 'TS-02-BND', 'bnd', 'tpl_config_bnd', 'fitness-config-skill', 'generate_bnd', 2),
  ('TPL-REP', '重复抽样', '同用例重复 N 次 Pass^k 判定', 'TS-03-REP', 'rep', 'tpl_config_rep', 'fitness-config-skill', 'generate_rep', 3),
  ('TPL-SET', '固定样本集', 'Golden/Eval 样本集批量执行', 'TS-04-SET', 'set', 'tpl_config_set', 'fitness-sample-skill', 'from_example', 4),
  ('TPL-CHAIN', '多步链路', 'submit/stream 等多步串联', 'TS-05-CHAIN', 'chain', 'tpl_config_chain', 'fitness-config-skill', 'generate_chain', 5),
  ('TPL-PAIR', '对照对比', '三端/跨端 forbidden 扫描', 'TS-06-PAIR', 'pair', 'tpl_config_pair', 'fitness-config-skill', 'generate_pair', 6),
  ('TPL-NEG', '对抗专项', '注入/越界对抗阻断率', 'TS-07-NEG', 'neg', 'tpl_config_neg', 'fitness-config-skill', 'generate_neg', 7),
  ('TPL-OBS', '可观测稽核', 'journey/日志字段存在性', 'TS-08-OBS', 'obs', 'tpl_config_obs', 'fitness-config-skill', 'generate_obs', 8),
  ('TPL-LOAD', '压测容量', 'VU/持续时间与 SLO 判定', 'TS-09-LOAD', 'load', 'tpl_config_load', 'fitness-config-skill', 'generate_load', 9),
  ('TPL-MAN', '人工评审', '专家 rubric 打分多数决', 'TS-10-MAN', 'man', 'tpl_config_man', NULL, NULL, 10)
ON CONFLICT (template_code) DO NOTHING;
