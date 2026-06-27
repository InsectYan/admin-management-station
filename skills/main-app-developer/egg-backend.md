# 主应用 BFF 工作流

> 规范：`egg-backend.mdc`、`app-registry.mdc`

## 分层顺序

```
Model → Service → Controller → Router → Middleware
```

## 配置要点

- `PORT`、`POSTGRES_DB` 读环境变量
- `egg-sequelize`、`egg-jwt` 在 `plugin.js` 启用
- `app.js` `beforeStart` → `syncSchemaOnStartup`（见 `database-schema-sync.mdc`）
- 公开读路由加入 `jwt.ignore`（见 `subapp-onboarding.mdc`）
- 菜单/注册表读多：可用 `app/lib/cache.js`（memory）

## 验收

- [ ] `/api/health` 可用
- [ ] 响应 `{ code, message, data }`
- [ ] 写接口鉴权生效

具体端点与表结构见 `docs-project/` 主应用设计文档。
