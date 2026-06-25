# 主应用 Qiankun 基座工作流

> 规范：`qiankun-microfrontend.mdc`、`subapp-onboarding.mdc`

## 动态注册

```javascript
registerMicroApps(
  menus.map(menu => ({
    name: menu.microapp_name,
    entry: menu.entry || import.meta.env[`VITE_SUBAPP_${KEY}_ENTRY`],
    container: '#subapp-container',
    activeRule: `/media/${menu.route_prefix}`,
    props: { basename: `/media/${menu.route_prefix}`, menuData: menu },
  }))
);
start();
```

## 要点

- `entry` 为**浏览器**可访问的 URL（dev：`http://localhost:{子Vite端口}`）
- 菜单 `status !== enabled` 时不注册或 unregister
- 主应用路由 `/media/*` 指向子应用容器

## 联调

1. 子应用 frontend 先启动
2. 主应用加载菜单后点击对应项
3. 检查 Network：子应用资源从 entry 拉取，非 404

子应用侧适配见 [`../sub-app-developer/qiankun-subapp.md`](../sub-app-developer/qiankun-subapp.md)。
