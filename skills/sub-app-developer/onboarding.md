# 子应用接入主应用

> 规范：`subapp-onboarding.mdc`（完整条文以 rules 为准）

## Checklist 摘要

- [ ] `app-registry.mdc` + `docs-project/应用端口与命名注册表.md` 登记
- [ ] 主库 `subapp_registry` + `menu_items`（init 或 migration）
- [ ] 主应用 JWT `ignore` 含 `GET /api/menus`
- [ ] 子应用 `frontend/src/services/apiConfig.js` 处理 Qiankun 绝对 URL
- [ ] `VITE_SUBAPP_*_ENTRY` / `SUBAPP_*_ENTRY` 与 dev Vite 端口一致
- [ ] 子 BFF 启用 `egg-cors`、`egg-sequelize`
- [ ] 子 BFF `app.js` 注册 `beforeStart` → `syncSchemaOnStartup`（见 `database-schema-sync.mdc`）
- [ ] compose 内 `POSTGRES_PORT=5432`；宿主机映射见 registry
- [ ] `MainLayout` 满足 `subapp-layout.mdc`（菜单吸顶、内容区固定高内滚动）
- [ ] 样式隔离满足 `subapp-style-isolation.mdc`（`subappScope.js`、无前缀全局选择器）
- [ ] backend/frontend 有 `package-lock.json`

## 联调顺序

```
ams-{sub} local → 验证子应用 URL → ams-main local → 重启 BFF（自动 schema 同步）→ 主应用点菜单
```

## 参考实现

已登记子应用目录中的 `frontend/src/services/apiConfig.js`、`main.js`（Qiankun 导出）。
