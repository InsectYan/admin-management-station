# 子应用前端工作流

> 规范：`vue-web.mdc`、`vue-element-plus.mdc`、`app-self-contained.mdc`

## 目录

```
{app}/frontend/src/
  views/
  components/
  router/
  services/
    apiConfig.js    # ★ Qiankun 绝对 BFF URL
  qiankun/
```

## 实现顺序

1. Vite + Vue 3 + Element Plus + `vite-plugin-qiankun`
2. 实现 `apiConfig.js`（见 [onboarding.md](onboarding.md)）
3. `main.js` 导出 bootstrap / mount / unmount
4. Router `base` 从 Qiankun props 获取
5. 嵌入态隐藏重复顶栏（`__POWERED_BY_QIANKUN__`）

## 验收

- [ ] 独立 dev 与嵌入主应用均可访问
- [ ] Network 中 API 指向子 BFF 端口
