-- 已有 testgen_db 升级：generation_jobs.agent_context（进度页 Agent 配置）
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS agent_context JSONB DEFAULT '{}';
