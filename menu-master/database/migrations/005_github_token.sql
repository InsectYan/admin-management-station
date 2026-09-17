-- 个人信息：GitHub PAT，供运维子应用拉仓 / 列 tag，接口永不回传明文

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS github_login VARCHAR(128),
  ADD COLUMN IF NOT EXISTS github_token TEXT;
