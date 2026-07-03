# testgen-sub deploy（app_key=testgen）

自包含栈：`postgres` + `api-testgen` + `testgen-frontend`

## 快速开始

```bash
cd project-sub/testgen-sub/deploy
npm link
ams-testgen local          # 全栈本地启动
ams-testgen local:infra    # 仅 Postgres
ams-testgen db             # Schema 同步 + 种子注入
ams-testgen db:sync        # 仅 DDL
ams-testgen db:reset       # 清库重建
ams-testgen help
```

配置：`deploy/config/.env.local`（端口见 AMS `docs-project/应用端口与命名注册表.md`）

## 数据库

| 命令 | 说明 |
|------|------|
| `ams-testgen db` | 启动 schemaSync + 全量 seed |
| `ams-testgen db:sync` | 仅执行 `database/tables/*/init.sql` + migrations |
| `ams-testgen db:reset` | DROP → 重建 → seed |
| `ams-testgen db:seed <表名>` | 单表注入（若 CLI 支持） |

新增表须同步：`database/migrations/`、`backend/app/model/`、必要时 `database/tables/`。详见 `.cursor/rules/subapp-development.mdc`。

## Agent 联调

BFF 通过 `agentProxy` 调用 Agent 平台 Skill（配置见 `backend/config/config.default.js` → `agentPlatform`）。

| 步骤 | 命令 |
|------|------|
| 完整说明 | [../docs/设计-Agent联调配置.md](../docs/设计-Agent联调配置.md) |
| 在线探活 | `cd ../backend && npm run smoke:agent-linkage`（需 BFF + Agent 已启动） |
| 离线规则 | `cd ../backend && npm run smoke:e6` |

本地开发须先启动 Agent 平台（`PORT=4001`）并配置 `TESTGEN_BFF_URL` / Token，见联调文档 §4～§5。

## 接入主应用

见 [../README.md](../README.md) Qiankun 接入说明。
