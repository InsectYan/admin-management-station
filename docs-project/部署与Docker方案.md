# 部署与 Docker 方案

> **架构**：每应用**自包含** compose（Postgres + 业务服务），见 `.cursor/rules/app-self-contained.mdc`  
> **缓存**：默认 **memory**（见 `cache-local.mdc`），无需 Redis 容器  
> **CLI**：`ams-main` / `ams-novel`  
> **规范**：`deploy-cli.mdc`、`docker.mdc`、`docker-compose.mdc`、`app-registry.mdc`  
> **端口**：[应用端口与命名注册表.md](./应用端口与命名注册表.md)

## 1. 原则

| 原则 | 说明 |
|------|------|
| 自包含 | 每个 `{app}/deploy/docker-compose.yml` **自带** Postgres |
| 本地缓存 | `CACHE_DRIVER=memory`，进程内缓存菜单/子应用注册表 |
| 可拆出 | 复制 `menu-master/` 或 `novel-sub/` 整目录即可独立运行 |
| 无共享 infra | **禁止**依赖根 `deploy/compose/infra.yml`（已废弃） |
| 无内嵌 Agent | 智能体由 `agent-management-master` 独立部署 |

## 2. 服务拓扑

### menu-master（app_key=main）

| 容器 | 端口 | 说明 |
|------|------|------|
| `ams-main-postgres` | 5432 | `admin_platform` + `subapp_registry` |
| `ams-api-main` | 5200 | Egg.js BFF |
| `ams-main-frontend` | 5100 | Vite dev |

### novel-sub（app_key=novel）

| 容器 | 端口 | 说明 |
|------|------|------|
| `ams-novel-postgres` | **5301** | `novel_db` |
| `ams-api-novel` | 5201 | Egg.js BFF |
| `ams-novel-frontend` | 8081 / dev 5101 | 子应用 UI |

## 3. 目录结构

```
admin-management-station/          # 工作区聚合（非运行时依赖）
├── menu-master/
│   ├── frontend/ backend/ database/
│   └── deploy/                    # ams-main
├── novel-sub/
│   ├── frontend/ backend/ database/
│   └── deploy/                    # ams-novel
├── docs-project/
└── skills/
```

## 4. 启动

```bash
# 主应用
cd menu-master/deploy && npm link && ams-main local

# 小说子应用
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
```

### 主应用 + novel-sub 联调（Qiankun）

```bash
cd menu-master/backend && npm run db:init   # subapp_registry + menu_items
# 主应用 :5100/:5200 + novel-sub frontend :5101
```

### 停止

```bash
ams-main local:down
ams-novel local:down
```

## 5. compose 要点（无 include infra）

每个应用的 `docker-compose.yml` 内直接声明 `postgres` service，独立 network/volume 名（如 `ams-novel-net`）。

## 6. Nginx（主应用集成子应用时）

```nginx
location /api/ {
  proxy_pass http://ams-api-main:5200/api/;
}

location /subapps/novel-app/ {
  alias /var/www/novel-sub/frontend/dist/;
  try_files $uri $uri/ /subapps/novel-app/index.html;
}
```

开发时子应用 entry 由菜单 API `entry` 字段提供（默认 `http://localhost:5101`）。
