# 子应用 BFF 工作流

> 规范：`egg-backend.mdc`、`app-registry.mdc`

## 分层顺序

```
Model → Service → Controller → Router → Middleware
```

## 子应用特有配置

```javascript
// plugin.js
exports.sequelize = { enable: true, package: 'egg-sequelize' };
exports.cors = { enable: true, package: 'egg-cors' };
```

- 独立 `POSTGRES_DB`（见 registry）
- Docker 内：`POSTGRES_HOST=postgres`、`POSTGRES_PORT=5432`
- 宿主机 dev：`.env` 使用 PG **宿主机映射端口**
- `app.js` `beforeStart` → `syncSchemaOnStartup`（见 `database-schema-sync.mdc`）

## 验收

- [ ] `/api/health`
- [ ] 重启 BFF 后 schema 自动同步（日志 `[SchemaSync]`）
- [ ] CORS 允许主应用 origin
- [ ] 响应格式统一

具体 REST 端点见 `docs-project/` 或 [`../project-developer/{app_key}/`](../project-developer/)。
