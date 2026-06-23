# 已废弃 — 共享 infra

原 `deploy/compose/infra.yml`（全仓共享 Postgres/Redis）**已废弃**，与 [`app-self-contained.mdc`](../.cursor/rules/app-self-contained.mdc) 冲突。

## 请改用各应用自管 infra

| 应用 | Postgres 容器 | Redis 容器 | CLI |
|------|---------------|------------|-----|
| 主应用 | `ams-main-postgres` | `ams-main-redis` | `ams-main local` |
| 小说 | `ams-novel-postgres` | `ams-novel-redis` | `ams-novel local` |

配置见：

- [`menu-master/deploy/docker-compose.yml`](../menu-master/deploy/docker-compose.yml)
- [`novel-sub/deploy/docker-compose.yml`](../novel-sub/deploy/docker-compose.yml)

`compose/infra.yml` 仅作历史参考，**新代码不得 include**。
