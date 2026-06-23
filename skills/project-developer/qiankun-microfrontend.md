# Qiankun 微前端集成工作流

> 编码规范：`.cursor/rules/qiankun-microfrontend.mdc`、`.cursor/rules/app-registry.mdc`

## 参考设计

- 主应用：`docs-project/私人管理平台主应用设计.md` §3.2、§3.6
- 子应用：`docs-project/小说管理页面子应用设计.MD` §通信机制
- 端口/entry：[`应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md)

## 集成流程

### 1. 主应用注册子应用

启动时从菜单 API 获取一级菜单，动态注册：

```javascript
registerMicroApps([
  {
    name: menu.microapp_name,       // 如 'novel-app'
    entry: '//localhost:5174',      // 小说 Vite dev；生产 /subapps/novel-app/
    container: '#subapp-container',
    activeRule: `/media/${menu.route_prefix}`,
    props: { menuData: menu, basename: `/media/${menu.route_prefix}` }
  }
]);
start();
```

**entry 对照**（见注册表）：

| app_key | Vite dev entry | Docker / 生产 entry |
|---------|----------------|---------------------|
| `novel` | `//localhost:5174` | `/subapps/novel-app/` |

### 2. 菜单 ↔ 子应用映射

| 菜单字段 | 用途 |
|---------|------|
| `microapp_name` | Qiankun `name`，全局唯一 |
| `route_prefix` | URL 前缀 + `activeRule` |
| `status` | `enabled` 才注册；禁用时 `unregisterMicroApps` |

### 3. 子应用适配

- 导出生命周期：`bootstrap` / `mount` / `unmount`
- Router `basename` = props.basename
- 独立运行 fallback：`window.__POWERED_BY_QIANKUN__ ? props.basename : '/'`

### 4. 通信

- **主 → 子**：props 传递用户信息、菜单元数据、basename
- **子 → 主 / 子 ↔ 子**：全局事件总线；unmount 时 `offAll()`
- **全局状态**：Qiankun `initGlobalState` 或自定义 emitter

### 5. 构建与部署

- 子应用独立 `npm run build`
- 产物放到主应用可 HTTP 访问的路径（如 `/subapps/{name}/`）
- 生产禁用 `file://` 加载

## 联调检查

- [ ] 菜单点击 → URL 变化 → 正确子应用 mount
- [ ] 切换菜单 → 旧子应用 unmount、新子应用 mount
- [ ] 样式不冲突（Qiankun 样式隔离）
- [ ] 禁用菜单项后子应用 unregister
- [ ] dev/prod entry 配置文档化
