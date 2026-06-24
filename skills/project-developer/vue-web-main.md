# 主应用前端工作流（Vue 3 Web SPA + Qiankun）

> 编码规范：`.cursor/rules/vue-web.mdc`、`.cursor/rules/qiankun-microfrontend.mdc`、**`.cursor/rules/subapp-onboarding.mdc`**

## 参考设计

- `docs-project/私人管理平台主应用设计.md`
- `docs-project/部署与Docker方案.md`
- **`docs-project/应用端口与命名注册表.md`**（`app_key=main`）

## 目标架构

```
浏览器 → Nginx（主应用静态）→ Vue 3 基座（Qiankun）→ 子应用 HTTP entry
         ↓ HTTP API
       Egg.js BFF 容器
```

## 目录

```
menu-master/                 # 主应用开发目录（或 apps/main-*）
├── frontend/src/            # Vite dev :5173
└── backend/                 # Egg.js   :7001 · DB admin_platform
docker/
deploy/docker-compose.yml
```

## 主应用端口（app_key=main）

| 用途 | 端口 |
|------|------|
| Egg.js BFF | 7001 |
| Vite dev | 5173 |
| Nginx Docker | 8080 |
| PostgreSQL | `admin_platform` @ :5432 |

## 实现顺序

### 1. 前端基座

- Vite + Vue 3 + Vue Router + Element Plus + Qiankun
- 布局：左侧菜单 + 右侧 `#subapp-container`

### 2. 菜单与 JWT

- `services/menuService.js` → `GET /api/menus`、`/api/menus/root`
- **主应用 `egg-jwt` 须 ignore 上述 GET**，否则侧栏 401（见 `subapp-onboarding.mdc`）

### 3. Qiankun 注册

- 从菜单 API 动态 `registerMicroApps`
- `entry`：`http://localhost:{子Vite端口}`（浏览器访问）；`VITE_SUBAPP_*_ENTRY` fallback

### 4. Docker

```bash
ams-main local:infra   # 仅 Postgres
ams-main local         # 全栈
```

## 验收

- [ ] 浏览器访问主应用，菜单从 API 加载
- [ ] 点击菜单加载对应子应用
- [ ] 无 IPC / 桌面端依赖
- [ ] `docker compose up` 可启动完整环境
