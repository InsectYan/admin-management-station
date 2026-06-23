# Docker 部署工作流

> 编码规范：`.cursor/rules/docker.mdc`、**`.cursor/rules/docker-compose.mdc`**、`.cursor/rules/deploy-cli.mdc`

## 参考

- `docs-project/部署与Docker方案.md`
- **`docs-project/应用端口与命名注册表.md`**
- [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy) — 每应用 deploy 结构范本

## 每应用 deploy（对齐 cartoon-agent）

| 路径 | 用途 |
|------|------|
| `deploy/compose/infra.yml` | 共享 DB + Redis（仓库根） |
| `{app}/deploy/docker-compose.yml` | 单文件编排（include infra） |
| `{app}/deploy/config/` | `.env.local` + Dockerfile.* |
| `{app}/deploy/scripts/` | `ams-{app_key}` CLI |

## 执行步骤（新应用）

1. 登记 `app-registry.mdc` 与 `{app}/deploy/config/.env.local`
2. 复制已有 `deploy/` 骨架，改 CLI 名与 compose
3. Dockerfile **仅**放在 `{app}/deploy/config/`
4. 验证：`ams-{app_key} local`

## 命令

| CLI | 典型命令 |
|-----|----------|
| `ams-main` | `local`、`local:infra`、`local:frontend` |
| `ams-novel` | `local`（profile novel） |
| `ams-agent` | `local`（profile agent） |

## 验收

- [ ] Windows 下 `ams-main local` 可用
- [ ] `cd menu-master/deploy && docker compose up` 可独立启动
- [ ] 无应用根目录 `docker/`、`docker-compose.services.yml`
- [ ] 文档与注册表端口一致
