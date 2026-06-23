# Agent 部署配置（app_key=agent）

对齐 [cartoon-agent/deploy/config](E:/AI Tools/projects/cartoon-agent/deploy/config)。

| 文件 | 说明 |
|------|------|
| `.env.local` | 本地 Docker 默认 |
| `Dockerfile` | Agent 服务镜像（本地 / 上云共用，实现后生效） |

加载顺序：`deploy/config/.env.local` → `src/.env`（实现后，个人覆盖）

```bash
cd apps/agent-server/deploy && npm link
ams-agent local
```
