# Agent Server — 部署与 CLI

`app_key=agent` · 对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)：**本目录 `deploy/` + CLI `ams-agent`**。

Pi v3 BFF + Agent 进程，端口 **7003**。实现前为占位容器。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地 Docker | **`ams-agent local`** |
| 仅 DB + Redis | **`ams-agent local:infra`** |
| 清库重建 | **`ams-agent local:reset`** |
| 停止 | **`ams-agent local:down`** |
| 环境变量 | [config/README.md](./config/README.md) |

```bash
cd apps/agent-server/deploy && npm link
ams-agent local
```

## 目录结构

```
apps/agent-server/deploy/
├── docker-compose.yml       # infra + agent-server（profile agent）
├── config/                  # .env.local + Dockerfile
└── scripts/                 # ams-agent CLI
```

共享 infra：[`deploy/compose/infra.yml`](../../../deploy/compose/infra.yml)

## Agent 运行时边界

```
调用方 ──HTTP:7003──► agent-server（BFF + Pi）
                        └─ PostgreSQL（元数据）
```

Pi 工作区（`workspace-templates/`、`workspaces/`）属于具体业务子应用，由环境变量挂载。设计文档：[Agent开发方案.md](../../../docs-project/Agent开发方案.md)

业务说明见 [../README.md](../README.md)。
