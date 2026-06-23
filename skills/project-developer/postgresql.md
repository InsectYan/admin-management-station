# PostgreSQL 数据库工作流

> 编码规范：`.cursor/rules/postgresql.mdc`、`.cursor/rules/app-registry.mdc`

## 参考设计

- 菜单表：`docs-project/私人管理平台主应用设计.md` §3.4
- 小说相关表：`docs-project/小说管理页面子应用设计.MD` §数据库设计

## 实现顺序

```
登记 app_key / POSTGRES_DB → DDL → 索引 → 外键 → ORM Model → Migration
```

## 多库策略

| app_key | 数据库名 | 典型表 |
|---------|----------|--------|
| `main` | `admin_platform` | `menu_items` |
| `novel` | `novel_db` | `novels`, `chapters`, `users` |
| `agent` | `admin_platform` | Agent 元数据 |

同一 PostgreSQL 实例（`:5432`），各 BFF 连接**各自** `POSTGRES_DB`，禁止混连。

## 主应用表

### menu_items

```sql
CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER REFERENCES menu_items(id),
  route_prefix VARCHAR(50) NOT NULL,
  microapp_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'enabled',
  "order" INTEGER DEFAULT 0,
  icon VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menu_parent_id ON menu_items(parent_id);
CREATE INDEX idx_menu_route_prefix ON menu_items(route_prefix);
CREATE INDEX idx_menu_status ON menu_items(status);
```

## 子应用表

### novels

- 字段：`title`、`author_id`、`status`、`plot JSONB`、`progress`、`word_count`、`draft JSONB`
- 索引：`title`、`status`、`author_id`；`plot` 用 GIN

### chapters

- 外键 `novel_id REFERENCES novels(id) ON DELETE CASCADE`
- 组合索引 `(novel_id, chapter_number)`

### users

- `username`、`email` UNIQUE；`role` 默认 `'reader'`

## ORM 映射

- Egg.js：`app/model/` 定义 Sequelize/egg-orm 模型
- 模型字段与 DDL 一一对应；`JSONB` 映射为 JSON 类型
- 时间戳字段启用 ORM 自动维护（`timestamps: true`）

## Migration

- 文件名：`{timestamp}-{description}.js` 或 `.sql`
- 生产 `synchronize: false`，所有变更走 migration
- 回滚脚本与升级脚本成对维护

## 验收

- [ ] 所有业务表含 `created_at`、`updated_at`
- [ ] 外键与 ON DELETE 策略符合设计
- [ ] 索引覆盖设计文档中的查询场景
- [ ] ORM 模型与 DDL 字段一致
