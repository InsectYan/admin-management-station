# testgen-sub · AI智能测试平台

自包含子应用（`app_key=testgen`），提供测试用例生成平台的文档管理、生成任务编排与用例展示。

## 端口（见 docs-project/应用端口与命名注册表.md）


| 服务           | 端口   |
| ------------ | ---- |
| API          | 5202 |
| Vite         | 5102 |
| Postgres 宿主机 | 5302 |


## 本地启动

```bash
cd project-sub/testgen-sub/deploy && npm link && ams-testgen local
```

**已有数据库卷升级**（若 `POST /api/generation-jobs` 报 500、`agent_context does not exist`）：

```bash
docker exec ams-testgen-postgres psql -U admin -d testgen_db -f - < ../database/migrations/001_add_agent_context.sql
```

或在容器内执行：`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS agent_context JSONB DEFAULT '{}';`

## 架构

- **frontend/** — Vue 3 + Element Plus + AntV（测试范围 / 进度 / 用例管理）
- **backend/** — Egg.js BFF，代理调用 Agent 平台 `testgen-skill`
- **database/** — PostgreSQL 初始化脚本

Agent 能力由 `agent-management-sub/plugins/testgen-skill` 提供，不在本子应用内嵌。

## Fitness 测试库（数据注入）

须先启动 Postgres（`ams-testgen local` 或 `ams-testgen local:infra`），再执行：

```bash
ams-testgen db                 # 同步 Schema + 全量注入 23 张 Fitness 表
ams-testgen db:seed            # 同上
ams-testgen db:seed test_item_detail   # 仅注入指定表
ams-testgen db:sync            # 仅 DDL，不注入数据
ams-testgen db:reset           # 清空全库 → 重建 Schema → 全量注入（含运行时表）
ams-testgen db:reset test_item_detail  # 删表重建 + 仅注入指定表
```

注入规则对齐 `fitness-agent-test-docs/数据库详细表/_scripts/generate-all-tables.mjs`（`sqlVal` + `ON CONFLICT DO NOTHING` + 外键顺序）。表目录在 `database/tables/<表名>/`，须同时含 `init.sql` 与 `data.json`。

**自动补列**：`ams-testgen db` 会对比各表 `init.sql` 的 CREATE TABLE，对已有库执行 `ADD COLUMN IF NOT EXISTS`，再注入数据，避免新增字段导致注入失败。

**中文名**：`database/display-labels.json` 定义字段标签与 FK→名称映射；注入前会自动 enrich `data.json` 的 `*_name` 字段；列表 API 也会 JOIN 返回中文名。