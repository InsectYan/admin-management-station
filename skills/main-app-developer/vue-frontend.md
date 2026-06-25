# 主应用前端工作流

> 规范：`vue-web.mdc`、`qiankun-microfrontend.mdc`

## 目录

```
{main-app}/frontend/src/
  components/       # 布局、侧栏
  router/
  services/         # menuService 等
  qiankun/          # registerMicroApps、config
```

## 实现顺序

1. Vite + Vue 3 + Vue Router + Element Plus
2. 布局：侧栏 + `#subapp-container`
3. `services/*` 封装 `/api` 调用
4. 从菜单 API 加载数据并 `registerMicroApps`（见 [qiankun-base.md](qiankun-base.md)）
5. 环境变量：`VITE_API_BASE`、`VITE_DEV_PORT`、`VITE_SUBAPP_*_ENTRY`

## 验收

- [ ] 独立 dev 可访问基座
- [ ] 菜单从 BFF 加载
- [ ] 子应用 mount 区域正常
