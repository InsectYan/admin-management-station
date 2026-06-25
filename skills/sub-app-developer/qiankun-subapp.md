# 子应用 Qiankun 适配

> 规范：`qiankun-microfrontend.mdc`

## 生命周期

使用 `vite-plugin-qiankun` 的 `renderWithQiankun` 或手动导出：

- `bootstrap` — 初始化
- `mount` — 创建 app、挂载 router（传入 `props.basename`）
- `unmount` — 销毁实例、清理监听

## Router basename

```javascript
export function createAppRouter(basename) {
  return createRouter({
    history: createWebHistory(basename),
    routes: [/* ... */],
  });
}
```

独立运行：`basename = '/'`；嵌入：使用 props.basename（如 `/media/{route_prefix}`）。

## 与主应用协作

- `microapp_name` 与 `vite-plugin-qiankun` 插件名一致
- dev entry 端口 = registry Vite 端口

主应用注册见 [`../main-app-developer/qiankun-base.md`](../main-app-developer/qiankun-base.md)。
