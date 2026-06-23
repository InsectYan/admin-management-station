# 部署与 Docker 方案

> **架构**：每应用**自包含** compose（Postgres + Redis + 业务服务），见 `.cursor/rules/app-self-contained.mdc`  
> **CLI**：`ams-main` / `ams-novel`（**无** `ams-agent`）  
> **规范**：`deploy-cli.mdc`、`docker.mdc`、`docker-compose.mdc`、`app-registry.mdc`  
> **端口**：[应用端口与命名注册表.md](./应用端口与命名注册表.md)

## 1. 原则

| 原则 | 说明 |
|------|------|
| 自包含 | 每个 `{app}/deploy/docker-compose.yml` **自带** Postgres、Redis（可选） |
| 可拆出 | 复制 `menu-master/` 或 `novel-sub/` 整目录即可独立运行 |
| 无共享 infra | **禁止**依赖根 `deploy/compose/infra.yml`（已废弃） |

## 2. 服务拓扑

### menu-master（app_key=main）

| 容器 | 端口 | 说明 |
|------|------|------|
| `ams-main-postgres` | 5432 | `admin_platform` |
| `ams-main-redis` | 6379 | 菜单缓存等 |
| `ams-api-main` | 7001 | Egg.js BFF |
| `ams-main-frontend` | 5173 | Vite dev |

### novel-sub（app_key=novel）

| 容器 | 端口 | 说明 |
|------|------|------|
| `ams-novel-postgres` | **5433** | `novel_db` |
| `ams-novel-redis` | **6380** | 可选 |
| `ams-api-novel` | 7002 | Egg.js BFF |
| `ams-novel-agent` | 7003 | Pi Agent（内置） |
| `ams-novel-frontend` | 8081 / dev 5174 | 子应用 UI |

## 3. 目录结构

```
admin-management-station/          # 工作区聚合（非运行时依赖）
├── menu-master/
│   ├── frontend/ backend/ database/
│   └── deploy/                    # ams-main
├── novel-sub/
│   ├── frontend/ backend/ agent/ database/
│   ├── workspace-templates/
│   └── deploy/                    # ams-novel（含 agent 服务）
├── docs-project/
└── skills/
```

## 4. 启动

```bash
# 主应用
cd menu-master/deploy && npm link && ams-main local

# 小说子应用（含 Agent）
cd novel-sub/deploy && npm link && ams-novel local
```

### 宿主机热更新

```bash
ams-main local:infra
cd menu-master/backend && npm run dev
cd menu-master/frontend && npm run dev

ams-novel local:infra
cd novel-sub/backend && npm run dev
cd novel-sub/frontend && npm run dev
cd novel-sub/agent && npm run dev
```

### 停止

```bash
ams-main local:down
ams-novel local:down
```

## 5. compose 要点（无 include infra）

每个应用的 `docker-compose.yml` 内直接声明 `postgres`、`redis` service，独立 network/volume 名（如 `ams-novel-net`）。

## 6. Nginx（主应用集成子应用时）

```nginx
location /api/ {
  proxy_pass http://ams-api-main:7001/api/;
}
location /agent-api/ {
  proxy_pass http://ams-novel-agent:7003/;   # 联调时指向子应用 Agent
}
location /subapps/novel-app/ {
  proxy_pass http://ams-novel-frontend:5174/;
}
```

## 7. 环境变量

各应用 **`{app}/deploy/config/.env.local`**（可提交）+ **`{app}/backend/.env`**、**`{app}/agent/.env`**（gitignore 密钥）。

## 8. 健康检查

| 服务 | 路径 |
|------|------|
| 平台 BFF | `GET /api/health` |
| Agent | `GET /health` |
| PostgreSQL | `pg_isready` |

## 9. 相关文档

- [应用端口与命名注册表.md](./应用端口与命名注册表.md)
- [Agent开发方案.md](./Agent开发方案.md)
- [menu-master/deploy/README.md](../menu-master/deploy/README.md)
- [novel-sub/deploy/README.md](../novel-sub/deploy/README.md)
