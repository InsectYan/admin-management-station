# 子应用 Docker 工作流

> 规范：`docker-compose.mdc`、`deploy-cli.mdc`

## 栈

`postgres` + `api` + `frontend`

## 新建子应用

1. 复制已登记子应用整目录
2. 改 `app_key`、端口、compose 容器名
3. `npm link` 后 `ams-{app_key} local`

## 验收

- [ ] 独立 compose 可启动
- [ ] 无根 infra 依赖
