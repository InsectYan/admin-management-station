# 主应用前端工作流（Electron-Egg + React）

> 编码规范：`.cursor/rules/electron-react.mdc`

## 参考设计

`docs-project/私人管理平台主应用设计.md`

## 目标架构

```
Electron 主进程 → IPC → React 渲染进程（Qiankun 基座）→ 子应用容器
```

## 目录（Electron-Egg）

```
myprivateplatform/
├── electron/
│   ├── config/
│   ├── controller/
│   ├── service/
│   ├── model/
│   └── preload/
├── frontend/src/
│   ├── components/     # 菜单栏、布局
│   ├── containers/     # 主应用容器
│   ├── hooks/
│   └── utils/
└── package.json
```

## 实现顺序

### 1. Electron 主进程

- 创建 BrowserWindow，`contextIsolation: true`，加载预加载脚本
- 窗口关闭与应用生命周期管理

### 2. 预加载脚本

- `contextBridge.exposeInMainWorld('api', { ... })`
- 暴露菜单 CRUD 的 IPC 封装（或 HTTP 代理）

### 3. React 基座布局

- 左侧：菜单树（从 API/IPC 获取 `menu_items`）
- 右侧：Qiankun 子应用挂载容器 `#subapp-container`

### 4. 菜单渲染

菜单项字段：`id`、`name`、`parent_id`、`route_prefix`、`microapp_name`、`status`、`order`、`icon`

- 树形渲染，`parent_id = NULL` 为一级菜单
- 点击菜单 → 更新 React Router 路径 → 触发 Qiankun 加载

### 5. 路由

- 主路由：`/:appKey/*` 匹配子应用
- 菜单 `route_prefix` 与 URL 联动

### 6. 状态管理

- 菜单数据、当前选中项、加载状态 → Redux 或 Context API
- 用户登录信息作为全局状态，通过 Qiankun props 传递给子应用

## 验收

- [ ] 主进程/渲染进程隔离，渲染进程无直接 Node API 调用
- [ ] 菜单从后端 API 动态加载并渲染
- [ ] 点击一级菜单能加载对应 Qiankun 子应用
- [ ] 预加载 API 仅暴露必要 IPC 通道
