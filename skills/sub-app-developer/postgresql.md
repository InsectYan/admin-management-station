# 子应用数据库工作流

> 规范：`postgresql.mdc`

## 顺序

```
登记 POSTGRES_DB → database/init.sql → ORM Model → Migration
```

## 隔离

- 子应用业务库**仅**本子应用 BFF 连接
- 与主库 `admin_platform` 分离

## 验收

- [ ] DDL 含时间戳与必要索引
- [ ] 与 `docs-project/` 设计文档一致（业务表由 project skill 对照）
