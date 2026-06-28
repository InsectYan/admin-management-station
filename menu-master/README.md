# menu-master — 主应用（菜单基座 + Qiankun）



`app_key=main` · API **5200** · Vite dev **5100** · 数据库 **`admin_platform`**



设计文档：[docs-project/私人管理平台主应用设计.md](../docs-project/私人管理平台主应用设计.md)  

部署与 CLI：[deploy/README.md](./deploy/README.md)



## 目录



```

menu-master/

├── backend/          # Egg.js BFF

├── frontend/         # Vue 3 + Vite + Qiankun 基座

├── database/         # init.sql

└── deploy/           # Docker + ams-main CLI（对齐 cartoon-agent）

```



## 快速开始



### 方式 A：Docker（推荐联调）



```bash

cd menu-master/deploy && npm link    # 每台机器首次

ams-main local

# 仅 infra：ams-main local:infra

```



| 端 | Docker | 宿主机 dev |

|----|--------|------------|

| 前端 | http://localhost:5100 | http://localhost:5100 |

| API | http://localhost:5200 | 同左 |



### 方式 B：宿主机热更新



```bash

ams-main local:infra

```



### 2. 后端



```bash

cd menu-master/backend

cp .env.example .env

npm install

npm run db:init

npm run dev

```



API：`http://localhost:5200/api/health`



### 3. 前端



```bash

cd menu-master/frontend

cp .env.example .env

npm install

npm run dev

```



浏览器：`http://localhost:5100`



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

主应用从 **`/api/menus/root`** 动态注册子应用；`database/init.sql` 种子包含 `novel-sub`：

| 表 | 说明 |
|----|------|
| `subapp_registry` | 子应用 entry、端口元数据 |
| `menu_items` | 侧栏菜单，`microapp_name=novel-app` |

菜单响应字段：`entry`、`active_rule`、`basename`、`subapp`。

前端 fallback：`VITE_SUBAPP_NOVEL_ENTRY`（默认 `http://localhost:5101`），见 `frontend/.env.local.example`。

| microapp_name | route_prefix | activeRule |
|---------------|--------------|------------|
| `novel-app` | `novel` | `/media/novel` |



## 规范



- [app-registry.mdc](../.cursor/rules/app-registry.mdc)

- [egg-backend.mdc](../.cursor/rules/egg-backend.mdc)

- [vue-web.mdc](../.cursor/rules/vue-web.mdc)

- [qiankun-microfrontend.mdc](../.cursor/rules/qiankun-microfrontend.mdc)

