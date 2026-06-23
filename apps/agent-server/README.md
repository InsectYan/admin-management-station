# Agent Server（app_key=agent）

Pi v3 BFF + Agent 进程，端口 **7003**。实现前为占位容器。

## 目录规划（实现时）

```
apps/agent-server/
├── docker-compose.yml          # 独立栈（include infra）
├── docker-compose.services.yml
├── src/                        # BFF + Pi
└── README.md
```

**Pi 工作区**（`workspace-templates/`、`workspaces/`、`data/`）属于**具体业务子应用**，不在仓库根目录配置。例如小说域 Agent 开发时，模板与运行时目录放在对应子应用包内（如 `apps/novel-agent/` 或子应用文档约定路径），由 `agent-server` 通过环境变量挂载。

## 启动

```bash
ams local:agent
# 或
cd apps/agent-server && docker compose --profile agent up -d --build
```

设计文档：[docs-project/Agent开发方案.md](../../docs-project/Agent开发方案.md)
