# 子应用前端工作流（Electron + React + Ant Design + Vite）

> 编码规范：`.cursor/rules/electron-react.mdc`、`.cursor/rules/react-antd.mdc`

## 参考设计

`docs-project/小说管理页面子应用设计.MD`

## 目标

作为 Qiankun 微前端子应用，实现小说管理、详情/编辑、新建小说（Steps 分步）等功能。

## 目录

```
novel-creation-app/
├── src/
│   ├── main/           # Electron 主进程（独立运行时）
│   ├── preload/
│   └── renderer/src/
│       ├── components/
│       ├── views/      # 列表、详情、新建步骤页
│       ├── stores/
│       ├── services/   # API 封装
│       └── router/
├── vite.config.ts
└── package.json
```

## 实现顺序

### 1. 项目初始化

- Vite + React 模板
- 安装：`antd`、`react-router-dom`、`vite-plugin-qiankun`
- dev 端口与主应用注册的 `entry` 一致（如 `3001`）

### 2. Qiankun 生命周期入口

在 renderer 入口导出 `bootstrap`、`mount`、`unmount`：

- `mount(props)`：从 `props.basename` 获取路由前缀，挂载 React 到 `props.container`
- `unmount()`：卸载 React、清理事件监听

### 3. 路由

- React Router，`basename` 来自 props 或 `window.__POWERED_BY_QIANKUN__` 判断
- 页面：小说列表、小说详情/编辑、新建小说（Steps）

### 4. 页面实现

| 页面 | 组件 | 要点 |
|-----|------|------|
| 小说列表 | `views/NovelList` | Table + 筛选 + 分页 |
| 新建小说 | `views/NovelCreate` | Steps 四步，步骤间暂存 store |
| 详情/编辑 | `views/NovelDetail` | Form + 章节管理 |

### 5. 服务层

- `services/novelService.ts` 封装 REST 调用（GET/POST/PUT/DELETE `/api/novels`）
- 组件通过 service 访问 API，不内联 fetch

### 6. 多步骤表单数据

- 步骤间数据暂存：`stores/` 或 electron-store（独立运行时）
- 最后一步提交完整 DTO 到后端

## 验收

- [ ] 独立运行（`npm run dev`）正常
- [ ] 嵌入主应用时 basename 正确、路由不冲突
- [ ] Ant Design 组件风格统一
- [ ] unmount 后无残留事件监听
