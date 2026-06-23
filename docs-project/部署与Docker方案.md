# 部署与 Docker 方案

> **编排入口**：[`deploy/docker-compose.yml`](../deploy/docker-compose.yml)  
> **CLI**：`ams local`（对齐 [cartoon-agent](E:/AI Tools/projects/cartoon-agent) 的 `cartoon local`）  
> **规范**：`.cursor/rules/deploy-cli.mdc`、`.cursor/rules/docker.mdc`、**`.cursor/rules/app-registry.mdc`**  
> **端口/库名注册表**：[应用端口与命名注册表.md](./应用端口与命名注册表.md)

## 1. 与 cartoon-agent 对齐

| 能力 | cartoon-agent | 本平台 |
|------|---------------|--------|
| 编排目录 | `deploy/docker-compose.yml` | 同左 |
| 全局 CLI | `cartoon local` | **`ams local`** |
| 配置分层 | `deploy/config/.env.local` + `server/.env` | `deploy/config/.env.local` + `apps/*/.env` |
| Windows | PowerShell 封装 compose | 同左 |
| Agent 进程 | `cartoon-server:3001` | `ams-agent-server:7003` |

## 2. 服务拓扑

> 完整端口、Vite dev、数据库名见 **[应用端口与命名注册表.md](./应用端口与命名注册表.md)**。

| 服务 | app_key | 容器名 | API 端口 | 前端 Docker | Vite dev | 数据库名 |
|-----|---------|--------|----------|-------------|----------|----------|
| 主应用前端 | `main` | `ams-main-frontend` | — | 8080 | 5173 | — |
| 小说子应用 | `novel` | `ams-novel-frontend` | — | 8081 | 5174 | — |
| 平台 BFF | `main` | `ams-api-main` | 7001 | — | — | `admin_platform` |
| 小说 API | `novel` | `ams-api-novel` | 7002 | — | — | `novel_db` |
| **Agent** | `agent` | `ams-agent-server` | 7003 | — | 7003 | `admin_platform` |
| PostgreSQL | — | `ams-postgres` | 5432 | — | — | 多库 |
| Redis | — | `ams-redis` | 6379 | — | — | — |

## 3. 目录结构

```
admin-management-station/
├── menu-master/               # 主应用（frontend Vite :5173 · backend :7001）
├── apps/
│   ├── main-frontend/         # 可与 menu-master 对齐
│   ├── main-backend/
│   ├── novel-frontend/        # Vite :5174 · Docker :8081
│   ├── novel-backend/         # API :7002 · DB novel_db
│   └── agent-server/          # :7003
├── deploy/                    # ★ 编排与 CLI（非仓库根 compose）
│   ├── docker-compose.yml
│   ├── bin/ams.mjs
│   ├── config/.env.local
│   └── scripts/run.mjs
├── docker/                    # 各服务 Dockerfile
│   ├── main-frontend.Dockerfile
│   └── ...
├── workspace-templates/
├── workspaces/                # gitignore
└── data/                      # gitignore
```

## 4. 启动方式

### 4.1 全栈 Docker（推荐联调）

```bash
cd deploy && npm link    # 首次
ams local
```

等价：`docker compose -f deploy/docker-compose.yml --profile local up -d --build`

### 4.2 仅基础设施（宿主机热更新）

```bash
ams local:infra
# 另开终端（端口见应用端口与命名注册表）
cd menu-master/backend && npm run dev      # :7001
cd menu-master/frontend && npm run dev     # :5173
cd apps/novel-backend && npm run dev       # :7002
cd apps/novel-frontend && npm run dev      # :5174
cd apps/agent-server && npm run dev        # :7003
```

### 4.3 停止

```bash
ams local:down
```

## 5. docker-compose 片段（见 deploy/ 完整文件）

```yaml
# deploy/docker-compose.yml
services:
  postgres:
    profiles: ["local", "infra"]
    image: postgres:16-alpine
    ports: ["5432:5432"]

  agent-server:
    profiles: ["local"]
    build:
      dockerfile: deploy/config/Dockerfile.agent
    ports: ["7003:7003"]
    volumes:
      - ../workspaces:/workspaces
      - ../workspace-templates:/workspace-templates
      - ../data:/data
```

## 6. Nginx 路由（主应用）

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
location /api/ {
  proxy_pass http://ams-api-main:7001/api/;
}
location /agent-api/ {
  proxy_pass http://ams-agent-server:7003/;
}
location /subapps/novel-app/ {
  proxy_pass http://ams-novel-frontend:80/;
}
```

## 7. 环境变量

**团队默认**（可提交）：`deploy/config/.env.local`

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123

MAIN_PORT=7001
MAIN_POSTGRES_DB=admin_platform

NOVEL_PORT=7002
NOVEL_POSTGRES_DB=novel_db

AGENT_PORT=7003

JWT_SECRET=CHANGE_ME_LOCAL_JWT
```

**个人密钥**（gitignore）：`apps/agent-server/.env`、`menu-master/backend/.env` 等

## 8. 健康检查

| 服务 | 路径 |
|------|------|
| 平台 BFF | `GET /api/health` |
| Agent | `GET /health` |
| PostgreSQL | `pg_isready` |

## 9. 数据迁移

```bash
docker compose -f deploy/docker-compose.yml exec api-main npm run migrate:up
```

## 10. 实现状态

| 组件 | 状态 |
|------|------|
| `deploy/` + `ams` CLI | 已 scaffold |
| `apps/*` 业务代码 | 待按设计文档实现 |
| `Dockerfile.agent` | 占位，待 `apps/agent-server` 就绪后启用 |

## 11. 相关文档

- [deploy/README.md](../deploy/README.md)
- [Agent开发方案.md](./Agent开发方案.md)
- [**应用端口与命名注册表.md**](./应用端口与命名注册表.md)
- [cartoon-agent/deploy/README.md](E:/AI Tools/projects/cartoon-agent/deploy/README.md)
