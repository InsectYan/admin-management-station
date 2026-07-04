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

页面配置docker环境域名：host.docker.internal

## 架构

- **frontend/** — Vue 3 + Element Plus + AntV（测试范围 / 进度 / 用例管理）
- **backend/** — Egg.js BFF，代理调用 Agent 平台 `testgen-skill`
- **database/** — PostgreSQL 初始化脚本

Agent 能力由 `agent-management-sub/plugins/testgen-skill` 提供，不在本子应用内嵌。

## 开发规范（必读）

迭代开发须遵守 monorepo 规则：

| 规则 | 说明 |
|------|------|
| [subapp-development.mdc](../../.cursor/rules/subapp-development.mdc) | **变更登记、DB 联动、docs 同步（主规范）** |
| [agent-skill-development.mdc](../../.cursor/rules/agent-skill-development.mdc) | **新 Skill 默认落点 agent-management-sub** |
| [subapp-onboarding.mdc](../../.cursor/rules/subapp-onboarding.mdc) | Qiankun 接入 |
| [database-schema-sync.mdc](../../.cursor/rules/database-schema-sync.mdc) | 启动 Schema 同步 |
| [fitness-agent-test-automation-sync.mdc](../../.cursor/rules/fitness-agent-test-automation-sync.mdc) | **fitness-agent 单测 → test_item_detail 自动化同步** |

### 变更须登记的文件

| 类型 | 文件 |
|------|------|
| **文档索引** | [docs/README.md](./docs/README.md) |
| 待办 / 功能节点 | [docs/待办-开发节点追踪.md](./docs/待办-开发节点追踪.md) |
| Agent 任务 | [docs/待办-Agent开发任务清单.md](./docs/待办-Agent开发任务清单.md) |
| Agent 联调 | [设计-Agent联调配置.md](./docs/设计-Agent联调配置.md)（含 `smoke:agent-linkage`） |
| 表结构说明 | [database/tables/\<表名\>/表说明.md](./database/tables/) |

改表、新 Skill、新 API/页面时须在上述文件中标识（格式见 `subapp-development.mdc` §1）。

### 本应用文档（开发后须同步）

| 文档 | 路径 |
|------|------|
| **文档索引** | [docs/README.md](./docs/README.md) |
| 架构与流程图 | [docs/测试平台架构关系图.md](./docs/测试平台架构关系图.md) |
| 评分与后续计划 | [docs/项目评分与后续计划.md](./docs/项目评分与后续计划.md) |
| 配置模板设计 | [docs/设计-配置模板与52大类.md](./docs/设计-配置模板与52大类.md) |
| Agent 协作设计 | [docs/设计-Agent协作与Skill嵌入.md](./docs/设计-Agent协作与Skill嵌入.md) |
| AMS 平台总览 | [docs-project/AMS平台架构关系图.md](../../docs-project/AMS平台架构关系图.md) |

### 数据库 CLI（ams-testgen）

须先启动 Postgres（`ams-testgen local` 或 `ams-testgen local:infra`）：

```bash
ams-testgen db                 # 同步 Schema + 全量注入 Fitness 表
ams-testgen db:seed            # 同上
ams-testgen db:seed test_item_detail   # 仅注入指定表
ams-testgen db:sync            # 仅 DDL，不注入数据
ams-testgen db:reset           # 清空全库 → 重建 Schema → 全量注入
ams-testgen db:reset test_item_detail  # 删表重建 + 仅注入指定表
# 以下是每次更新数测试用例状态后，以此处理
cd admin-management-station/project-sub/testgen-sub
node test-project/fitness-agent/scripts/sync-automation-status.mjs
cd deploy && ams-testgen db:reset test_item_detail
```

**改表时须同步**：`init.sql` / `migrations/` / Model / `database/tables/` seed / `deploy/scripts/run.mjs` 表顺序，保证 `db:seed` 与 `db:reset` 行为一致（见 `subapp-development.mdc` §2）。

注入规则：`database/tables/<表名>/` 须含 `init.sql` 与 `data.json`；`database/display-labels.json` 定义中文标签。

## Fitness 测试库（数据注入）

（命令见上节「数据库 CLI」）

**自动补列**：`ams-testgen db` 会对比各表 `init.sql` 执行 `ADD COLUMN IF NOT EXISTS`，再注入数据。

**中文名**：注入前 enrich `data.json` 的 `*_name` 字段；列表 API JOIN 返回中文名。
