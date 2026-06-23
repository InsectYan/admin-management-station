# 小说子应用 deploy（app_key=novel）

自包含栈：`postgres` + `redis` + `api-novel` + `agent` + `novel-frontend`

```bash
cd novel-sub/deploy && npm link
ams-novel local
ams-novel local:infra
ams-novel help
```

配置：`config/.env.local`（端口见 `app-registry.mdc`）
