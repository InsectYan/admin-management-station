# 主应用前端工作流（React Web SPA + Qiankun）

> 编码规范：`.cursor/rules/react-web.mdc`、`.cursor/rules/docker.mdc`、`.cursor/rules/app-registry.mdc`

## 参考设计

- `docs-project/私人管理平台主应用设计.md`
- `docs-project/部署与Docker方案.md`
- **`docs-project/应用端口与命名注册表.md`**（`app_key=main`）

## 目标架构

```
浏览器 → Nginx（主应用静态）→ React 基座（Qiankun）→ 子应用 HTTP entry
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

- Vite + React + React Router + Qiankun
- 布局：左侧菜单 + 右侧 `#subapp-container`

### 2. 菜单渲染

- `services/menuService.js` 调用 `GET /api/menus/root`
- 树形菜单，点击更新路由

### 3. Qiankun 注册

- 从菜单 API 动态 `registerMicroApps`
- `entry` 指向各子应用注册端口（如小说 dev `//localhost:5174`，Docker `/subapps/novel-app/`）

### 4. Docker

```bash
docker compose -f docker-compose.dev.yml up -d   # postgres + redis
docker compose up -d --build                      # 全栈
```

## 验收

- [ ] 浏览器访问主应用，菜单从 API 加载
- [ ] 点击菜单加载对应子应用
- [ ] 无 IPC / 桌面端依赖
- [ ] `docker compose up` 可启动完整环境
