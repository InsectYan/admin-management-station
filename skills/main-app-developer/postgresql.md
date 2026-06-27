# 主应用数据库工作流

> 规范：`postgresql.mdc`

## 顺序

```
登记 app_key / POSTGRES_DB → DDL → 索引 → 外键 → ORM Model → Migration → app.js beforeStart schemaSync
```

## 启动同步

- 各 BFF 在 `app.js` `beforeStart` 自动执行 schema 同步（见 `database-schema-sync.mdc`）。
- `npm run db:init` 仅空库/排障；日常改表后重启 BFF 即可。

## 主库职责

- 菜单、`subapp_registry` 等**平台级**表（具体 DDL 见设计文档）
- 各子应用业务库独立，不在主 BFF 混连

## 验收

- [ ] 表含 `created_at`、`updated_at`
- [ ] migration 与 init.sql 策略明确（新卷 vs 已有卷）
