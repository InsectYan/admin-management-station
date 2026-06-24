# 子应用前端工作流（Vue 3 + Element Plus + Vite）

> 编码规范：`.cursor/rules/vue-web.mdc`、`.cursor/rules/vue-element-plus.mdc`、`.cursor/rules/app-self-contained.mdc`、**`.cursor/rules/subapp-onboarding.mdc`（接入主应用必读）**

## 参考设计

- `docs-project/小说管理页面子应用设计.MD`
- **`docs-project/应用端口与命名注册表.md`**（`app_key=novel`）

## 目录（自包含子应用）

```
novel-sub/
  frontend/src/          # Vite dev :5174
  backend/               # Egg.js :7002
  agent/                 # Pi :7003
  database/              # init.sql
  deploy/                # ams-novel
```

## 小说子应用端口（app_key=novel）

| 用途 | 端口 / 库名 |
|------|-------------|
| Egg.js API | 7002 |
| Pi Agent | 7003 |
| Vite dev | 5174 |
| Postgres 宿主机 | 5433 · `novel_db` |

## 实现顺序

1. 阅读 **`subapp-onboarding.mdc`**，登记 `app-registry` + 主库 `subapp_registry`
2. Vite + Vue 3 + Element Plus + `vite-plugin-qiankun`
3. `services/apiConfig.js`（Qiankun 下绝对 BFF URL）
4. 导出 Qiankun 生命周期（`main.js` + `renderWithQiankun`）；Router `base` 从 props 获取
5. 嵌入态 UI：隐藏重复顶栏（`__POWERED_BY_QIANKUN__`）
6. `ams-{sub} local` 验证；再与 `ams-main` 联调

## 验收

- [ ] 独立 `npm run dev` 可访问
- [ ] `http://localhost:{api}/api/health` 正常（非 401/500）
- [ ] 嵌入主应用：Network 请求 **子 BFF 绝对 URL**，非 `:5173/api`
- [ ] 嵌入主应用 basename、entry 端口与 registry 一致
- [ ] 复制 `{sub}/` 目录可脱离 monorepo 运行
