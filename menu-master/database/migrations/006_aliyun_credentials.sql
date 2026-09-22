-- 个人信息：阿里云账号，供运维部署 / AgentRun；接口不回传 AccessKey Secret 明文

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS aliyun_account_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS aliyun_access_key_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS aliyun_access_key_secret TEXT;
