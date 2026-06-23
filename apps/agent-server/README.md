# Agent Server（app_key=agent）

Pi v3 BFF + Agent 进程，端口 **7003**。实现前为占位容器。

**部署与 CLI**：[deploy/README.md](./deploy/README.md)

```bash
cd apps/agent-server/deploy && npm link
ams-agent local
```

## 目录规划（实现时）

```
apps/agent-server/
├── src/                        # BFF + Pi
├── deploy/                     # Docker + ams-agent CLI（对齐 cartoon-agent）
└── README.md
```

**Pi 工作区**（`workspace-templates/`、`workspaces/`、`data/`）属于**具体业务子应用**，由环境变量挂载。

设计文档：[docs-project/Agent开发方案.md](../../docs-project/Agent开发方案.md)
