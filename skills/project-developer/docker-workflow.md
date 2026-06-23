# Docker 部署工作流

> 编码规范：`.cursor/rules/app-self-contained.mdc`、`.cursor/rules/docker-compose.mdc`、`.cursor/rules/deploy-cli.mdc`

## 参考

- `docs-project/部署与Docker方案.md`
- `docs-project/应用端口与命名注册表.md`

## 每应用 deploy（自包含）

| 路径 | 用途 |
|------|------|
| `{app}/deploy/docker-compose.yml` | **完整栈**：postgres + redis + api + frontend + agent（可选） |
| `{app}/deploy/config/` | `.env.local` + Dockerfile.* |
| `{app}/deploy/scripts/` | `ams-{app_key}` CLI |

**禁止** include 根 `deploy/compose/infra.yml`。

## 新应用步骤

1. 复制 `novel-sub/` 或 `menu-master/` 整目录
2. 登记 `app-registry.mdc`（含独立 PG/Redis 宿主机端口）
3. 验证 `ams-{app_key} local` 可独立启动

## 命令

| CLI | 典型命令 |
|-----|----------|
| `ams-main` | `local`、`local:infra`、`local:frontend` |
| `ams-novel` | `local`、`local:infra`（含 Agent） |

## 验收

- [ ] 复制应用目录到新路径仍可 `ams-{app_key} local`
- [ ] 无 `apps/`、无共享 `ams-postgres`
- [ ] 文档与注册表端口一致
