# 部署与 Docker 方案

> **编排入口**：[`deploy/docker-compose.yml`](../deploy/docker-compose.yml)  
> **CLI**：`ams local`（对齐 [cartoon-agent](E:/AI Tools/projects/cartoon-agent) 的 `cartoon local`）  
> **规范**：`.cursor/rules/deploy-cli.mdc`、`.cursor/rules/docker.mdc`

## 1. 与 cartoon-agent 对齐

| 能力 | cartoon-agent | 本平台 |
|------|---------------|--------|
| 编排目录 | `deploy/docker-compose.yml` | 同左 |
| 全局 CLI | `cartoon local` | **`ams local`** |
| 配置分层 | `deploy/config/.env.local` + `server/.env` | `deploy/config/.env.local` + `apps/*/.env` |
| Windows | PowerShell 封装 compose | 同左 |
| Agent 进程 | `cartoon-server:3001` | `ams-agent-server:7003` |

## 2. 服务拓扑

| 服务 | 容器名 | 端口 | 职责 |
|-----|--------|------|------|
| 主应用前端 | `ams-main-frontend` | 8080 | Nginx + React + Qiankun |
| 小说子应用 | `ams-novel-frontend` | 8081 | Nginx + React + Ant Design |
| 平台 BFF | `ams-api-main` | 7001 | Egg.js 菜单/鉴权 |
| 小说 API | `ams-api-novel` | 7002 | Egg.js 小说业务 |
| **Agent** | **`ams-agent-server`** | **7003** | **BFF + Pi** |
| PostgreSQL | `ams-postgres` | 5432 | 持久化 |
| Redis | `ams-redis` | 6379 | 菜单缓存 |

## 3. 目录结构

```
admin-management-station/
├── apps/
│   ├── main-frontend/
│   ├── main-backend/
│   ├── novel-frontend/
│   ├── novel-backend/
│   └── agent-server/          # Pi v3（对齐 cartoon-agent server/）
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
# 另开终端
cd apps/main-backend && npm run dev
cd apps/main-frontend && npm run dev
cd apps/agent-server && npm run dev
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
POSTGRES_DB=admin_platform
JWT_SECRET=CHANGE_ME_LOCAL_JWT
```

**个人密钥**（gitignore）：`apps/agent-server/.env`（LLM API Key 等）

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
- [cartoon-agent/deploy/README.md](E:/AI Tools/projects/cartoon-agent/deploy/README.md)
