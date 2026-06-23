# Docker 部署工作流

> 编码规范：`.cursor/rules/docker.mdc`、**`.cursor/rules/docker-compose.mdc`**、`.cursor/rules/deploy-cli.mdc`

## 参考

- `docs-project/部署与Docker方案.md`
- **`docs-project/应用端口与命名注册表.md`**

## 分层 Compose

| 文件 | 用途 |
|------|------|
| `deploy/compose/infra.yml` | 共享 DB + Redis |
| `{app}/docker-compose.services.yml` | 单应用服务片段 |
| `{app}/docker-compose.yml` | 单应用独立栈 |
| `deploy/docker-compose.yml` | 根 include 全应用 |

## 执行步骤

1. 新应用按 **`docker-compose.mdc`** 创建 compose + Dockerfile
2. 登记 `app-registry.mdc` 与 `deploy/config/.env.local`
3. 在 `deploy/docker-compose.yml` 增加 include
4. 验证：`ams local`（主应用）、`ams local:all`（全栈）

## 命令

| 命令 | 用途 |
|------|------|
| `ams local` | 主应用栈（menu-master） |
| `ams local:all` | 全栈 + profiles |
| `ams local:infra` | 仅 DB + Redis |
| `ams local:down` | 停止 |

## 验收

- [ ] Windows 下 `ams local` 可用
- [ ] `cd menu-master && docker compose up` 可独立启动
- [ ] 文档与注册表端口一致
