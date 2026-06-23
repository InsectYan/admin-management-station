# 共享基础设施

本目录仅保留 **多应用共享** 的 PostgreSQL、Redis 与网络 `ams-net`。

各应用的 Docker 编排、CLI、环境变量与 README 均在 **各自 `deploy/` 目录**（对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy) 结构）。

## 应用 deploy 入口

| app_key | 目录 | CLI | 说明 |
|---------|------|-----|------|
| `main` | [`menu-master/deploy/`](../menu-master/deploy/) | **`ams-main`** | 主应用 infra + API + 前端 |
| `novel` | [`apps/novel/deploy/`](../apps/novel/deploy/) | **`ams-novel`** | 小说子应用（profile novel） |
| `agent` | [`apps/agent-server/deploy/`](../apps/agent-server/deploy/) | **`ams-agent`** | Pi Agent（profile agent） |

```bash
cd menu-master/deploy && npm link && ams-main local
cd apps/novel/deploy && npm link && ams-novel local
cd apps/agent-server/deploy && npm link && ams-agent local
```

## 共享 infra 文件

```
deploy/
└── compose/
    └── infra.yml    # ams-postgres、ams-redis、ams-net
```

各应用 `deploy/docker-compose.yml` 通过 **include** 引入 `compose/infra.yml`。

**注意**：多个应用栈同时 up 时会共用同一 Postgres/Redis 容器名与端口；并行开发时优先 **`ams-main local:infra`** 或只启动一个完整栈，避免重复创建 infra。

## 规范

- [docker-compose.mdc](../.cursor/rules/docker-compose.mdc) — 每应用 deploy 目录约定
- [deploy-cli.mdc](../.cursor/rules/deploy-cli.mdc) — 各应用 CLI 命令
- [app-registry.mdc](../.cursor/rules/app-registry.mdc) — 端口与库名

端口注册表：[应用端口与命名注册表.md](../docs-project/应用端口与命名注册表.md)
