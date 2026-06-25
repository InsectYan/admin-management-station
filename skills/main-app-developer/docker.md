# 主应用 Docker 工作流

> 规范：`app-self-contained.mdc`、`docker-compose.mdc`、`deploy-cli.mdc`

## 栈组成

`postgres` + `api` + `frontend`（见 `{main-app}/deploy/docker-compose.yml`）

## 命令

```bash
cd {main-app}/deploy && npm link
ams-main local
ams-main local:infra
ams-main local:down
```

## 验收

- [ ] 复制应用目录后可独立 `ams-main local`
- [ ] compose 不 include 根 infra
- [ ] 端口与 registry 一致
