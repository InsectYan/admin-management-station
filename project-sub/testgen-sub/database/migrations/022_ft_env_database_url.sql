-- local-docker：CLI station 测试默认 DATABASE_URL（容器内访问宿主机 Postgres）

UPDATE ft_execution_env
SET auth_configured = COALESCE(auth_configured, '{}'::jsonb) || jsonb_build_object(
  'database_url', 'postgresql://fitness:fitness_secret@host.docker.internal:5433/fitness_db'
),
updated_at = NOW()
WHERE name = 'local-docker'
  AND NOT (COALESCE(auth_configured, '{}'::jsonb) ? 'database_url');
