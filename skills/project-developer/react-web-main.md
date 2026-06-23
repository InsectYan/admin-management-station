# 主应用前端工作流（React Web SPA + Qiankun）

> 编码规范：`.cursor/rules/react-web.mdc`、`.cursor/rules/docker.mdc`

## 参考设计

- `docs-project/私人管理平台主应用设计.md`
- `docs-project/部署与Docker方案.md`

## 目标架构

```
浏览器 → Nginx（主应用静态）→ React 基座（Qiankun）→ 子应用 HTTP entry
         ↓ HTTP API
       Egg.js BFF 容器
```

## 目录

```
apps/
├── main-frontend/src/
│   ├── components/     # 菜单栏、布局
│   ├── containers/
│   ├── services/       # HTTP API 封装
│   └── hooks/
└── main-backend/       # Egg.js BFF
docker/
docker-compose.yml
```

## 实现顺序

### 1. 前端基座

- Vite + React + React Router + Qiankun
- 布局：左侧菜单 + 右侧 `#subapp-container`

### 2. 菜单渲染

- `services/menuService.js` 调用 `GET /api/menus/root`
- 树形菜单，点击更新路由

### 3. Qiankun 注册

- 从菜单 API 动态 `registerMicroApps`
- `entry` 指向子应用 Nginx URL（如 `/subapps/novel-app/`）

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
