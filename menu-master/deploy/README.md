# menu-master — 部署与 CLI

`app_key=main` · 对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)：**本目录 `deploy/` + CLI `ams-main`**。

本地 Docker：**Vite dev 容器**（`:5173`）+ Egg.js BFF + 共享 infra，**不使用** `nginx:alpine` 多阶段构建。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地全栈 Docker | **`ams-main local`** |
| 仅前端容器 | **`ams-main local:frontend`** |
| 仅 DB + Redis（宿主机热更新） | **`ams-main local:infra`** |
| 清库重建 | **`ams-main local:reset`** |
| 停止 | **`ams-main local:down`** |

```bash
cd menu-master/deploy && npm link
ams-main local
```

## 目录结构（与 cartoon-agent 一致）

```
menu-master/
├── backend/Dockerfile         # 历史 stub → deploy/config/Dockerfile
├── frontend/Dockerfile        # Vite dev（node:22-alpine）
├── frontend/.env.local.example
└── deploy/
    ├── docker-compose.yml
    ├── config/Dockerfile      # BFF 镜像
    └── scripts/               # ams-main CLI
```

## 本地容器

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:5173 | Vite dev + 热更新卷 |
| `ams-api-main` | http://localhost:7001 | Egg.js · `admin_platform` |
| `ams-postgres` | localhost:5432 | 共享实例 |
| `ams-redis` | localhost:6379 | 共享实例 |

Docker 内 API 代理：`frontend/.env.local` → `VITE_PROXY_TARGET=http://api-main:7001`

业务说明见 [../README.md](../README.md)。
