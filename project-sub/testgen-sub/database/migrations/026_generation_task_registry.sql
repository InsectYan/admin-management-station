-- 生成任务名称注册表（job_id ↔ task_name，供用例库筛选）
CREATE TABLE IF NOT EXISTS generation_task_registry (
  job_id INT PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_task_registry_name ON generation_task_registry (task_name);

-- 用例模板扩展：功能描述、适用场景
ALTER TABLE config_template_enum
  ADD COLUMN IF NOT EXISTS function_desc TEXT,
  ADD COLUMN IF NOT EXISTS scenario_desc TEXT;

UPDATE config_template_enum SET function_desc = description WHERE function_desc IS NULL;

UPDATE config_template_enum SET scenario_desc = CASE template_code
  WHEN 'TPL-DET' THEN 'HTTP/CLI 单次请求、探针、接口正常/异常路径'
  WHEN 'TPL-BND' THEN '入参边界、状态机矩阵、组件字段组合'
  WHEN 'TPL-REP' THEN '重复执行 Pass^k、LLM 稳定性、阶段文案'
  WHEN 'TPL-SET' THEN 'Golden 样本集、Eval/UAT、意图对照'
  WHEN 'TPL-CHAIN' THEN '多步 submit/stream、E2E 链路、续传'
  WHEN 'TPL-PAIR' THEN '三端差异、跨端 forbidden 扫描'
  WHEN 'TPL-NEG' THEN '注入/越界对抗、安全合规专项'
  WHEN 'TPL-OBS' THEN 'journey/日志字段、可观测稽核'
  WHEN 'TPL-LOAD' THEN '压测容量、SLO 判定、多实例'
  WHEN 'TPL-MAN' THEN '专家 rubric 人工评审、多数决'
  ELSE scenario_desc
END WHERE scenario_desc IS NULL;

-- 从现有用例回填任务注册表
INSERT INTO generation_task_registry (job_id, task_name)
SELECT DISTINCT t.generation_job_id, '任务 #' || t.generation_job_id
FROM test_item_detail t
WHERE t.generation_job_id IS NOT NULL
  AND t.is_active = TRUE
ON CONFLICT (job_id) DO NOTHING;
