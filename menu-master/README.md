# menu-master — 主应用（菜单基座 + Qiankun）

`app_key=main` · API **7001** · Vite dev **5173** · 数据库 **`admin_platform`**

设计文档：[docs-project/私人管理平台主应用设计.md](../docs-project/私人管理平台主应用设计.md)

## 目录

```
menu-master/
├── backend/          # Egg.js BFF
├── frontend/         # React + Vite + Qiankun 基座
└── database/         # init.sql
```

## 快速开始

### 1. 基础设施

```bash
ams local:infra
# 或：docker compose -f deploy/docker-compose.yml --profile infra up -d
```

### 2. 后端

```bash
cd menu-master/backend
cp .env.example .env
npm install
npm run db:init
npm run dev
```

API：`http://localhost:7001/api/health`

### 3. 前端

```bash
cd menu-master/frontend
cp .env.example .env
npm install
npm run dev
```

浏览器：`http://localhost:5173`

## API

| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/health` | 公开 |
| GET | `/api/menus` | 公开 |
| GET | `/api/menus/root` | 公开 |
| POST | `/api/menus` | admin + JWT |
| PUT | `/api/menus/:id` | admin + JWT |
| DELETE | `/api/menus/:id` | admin + JWT |

## Qiankun

一级菜单 `microapp_name` 与 entry 映射见 `frontend/src/qiankun/config.js`：

| microapp_name | 开发 entry |
|---------------|------------|
| `novel-app` | `VITE_SUBAPP_NOVEL_ENTRY`（默认 `http://localhost:5174`） |

`activeRule`：`/media/{route_prefix}`

## 规范

- [app-registry.mdc](../.cursor/rules/app-registry.mdc)
- [egg-backend.mdc](../.cursor/rules/egg-backend.mdc)
- [react-web.mdc](../.cursor/rules/react-web.mdc)
- [qiankun-microfrontend.mdc](../.cursor/rules/qiankun-microfrontend.mdc)
