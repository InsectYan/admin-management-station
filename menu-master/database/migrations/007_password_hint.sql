-- 登录密码提示：改密必填；登录页可按用户名查询提示（非密码本身）

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS password_hint VARCHAR(200);
