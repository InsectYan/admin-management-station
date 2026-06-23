# 小说子应用 — 部署与 CLI

`app_key=novel` · 对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)：**本目录 `deploy/` + CLI `ams-novel`**。

业务代码待实现：`apps/novel-backend`、`apps/novel-frontend`。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地 Docker | **`ams-novel local`** |
| 仅 DB + Redis | **`ams-novel local:infra`** |
| 清库重建 | **`ams-novel local:reset`** |
| 停止 | **`ams-novel local:down`** |

```bash
cd apps/novel/deploy && npm link
ams-novel local
```

## 目录结构

```
apps/novel/deploy/
├── docker-compose.yml       # infra + api-novel + novel-frontend（profile novel）
├── config/                  # .env.local + Dockerfile.*
└── scripts/                 # ams-novel CLI
```

共享 infra：[`deploy/compose/infra.yml`](../../../deploy/compose/infra.yml)

## 本地容器

| 容器 | 地址 |
|------|------|
| `ams-novel-frontend` | http://localhost:8081 |
| `ams-api-novel` | http://localhost:7002 |
