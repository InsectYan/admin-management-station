-- 项目本地路径，供 ops-project-skill 扫描生成配置
ALTER TABLE ops_projects
  ADD COLUMN IF NOT EXISTS source_path VARCHAR(1000);
