-- CLI 工作区路径（fitness-agent 仓库根目录，容器内通常为 /fitness-agent）

ALTER TABLE ft_execution_env
  ADD COLUMN IF NOT EXISTS cli_workspace_root VARCHAR(512);

UPDATE ft_execution_env
SET cli_workspace_root = '/fitness-agent'
WHERE name = 'local-docker'
  AND (
    project_code = 'fitness-agent'
    OR project_code IS NULL
    OR TRIM(COALESCE(project_code, '')) = ''
  )
  AND (cli_workspace_root IS NULL OR TRIM(cli_workspace_root) = '');
