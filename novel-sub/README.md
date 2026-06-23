# 小说子应用（app_key=novel）— 自包含完整项目

脱离 monorepo 时，复制本目录即可独立开发与部署。

## 模块

| 模块 | 路径 | 端口（默认） |
|------|------|-------------|
| 前端 | `frontend/` | Vite **5174** |
| Egg.js BFF | `backend/` | API **7002** |
| Pi Agent | `agent/` | **7003** |
| 数据库 | `backend/database/init.sql` | PG 宿主机 **5433** · `novel_db` |
| Redis | `deploy/docker-compose.yml` | 宿主机 **6380** |
| Pi 模板 | `workspace-templates/novel/` | — |
| 部署 | `deploy/` | `ams-novel` |

## 一键 Docker

```bash
cd deploy && npm link
ams-novel local          # postgres + redis + api + agent + frontend
ams-novel local:infra    # 仅 DB + Redis，宿主机 npm run dev
```

## 宿主机开发

```bash
# 初始化库
cd backend && npm install && npm run db:init

cd backend && npm run dev      # :7002
cd frontend && npm run dev     # :5174
cd agent && npm install && npm run dev   # :7003
```

Agent 配置：`agent/.env.example`（DB 默认 `127.0.0.1:5433/novel_db`）

## 规范

- [app-self-contained.mdc](../.cursor/rules/app-self-contained.mdc)
- [Agent开发方案.md](../docs-project/Agent开发方案.md)
