# admin-management-station — 部署与 CLI



对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)：**`deploy/` 目录 + 全局 CLI `ams`**。



## 日常入口



| 你想做什么 | 命令 |

|------------|------|

| 主应用 Docker（infra + menu-master） | **`ams local`** |

| 全栈（含 novel、agent profile） | **`ams local:all`** |

| 仅 DB + Redis | **`ams local:infra`** |

| 仅主应用（同 local） | **`ams local:main`** |

| 仅小说 / Agent | **`ams local:novel`** / **`ams local:agent`** |

| 清库重建 | **`ams local:reset`** |

| 停止 | **`ams local:down`** |



未 link：`node deploy/scripts/run.mjs local`



> **Windows 中文终端**：`.ps1` 须 UTF-8 BOM，见 [`.cursor/rules/windows-console.mdc`](../.cursor/rules/windows-console.mdc)



## 分层 Compose 架构



```

deploy/

├── compose/infra.yml              # 共享 PostgreSQL + Redis + ams-net

├── docker-compose.yml             # 根 include（infra + 各应用 services）

└── config/.env.local



menu-master/

├── docker-compose.yml             # 主应用独立栈

├── docker-compose.services.yml

└── docker/*.Dockerfile



apps/novel/、apps/agent-server/     # 各子应用/Agent 同上结构

```



规范：[`.cursor/rules/docker-compose.mdc`](../.cursor/rules/docker-compose.mdc)



**单应用启动**（不经过 ams）：



```bash

cd menu-master && docker compose up -d --build

cd apps/novel && docker compose --profile novel up -d --build

```



## 本地容器



> 完整对照表：[应用端口与命名注册表.md](../docs-project/应用端口与命名注册表.md)



| 容器 | app_key | 地址 | 说明 |

|------|---------|------|------|

| `ams-main-frontend` | `main` | http://localhost:8080 | 主应用；Vite dev **5173** |

| `ams-novel-frontend` | `novel` | http://localhost:8081 | profile `novel` |

| `ams-api-main` | `main` | http://localhost:7001 | Egg.js · `admin_platform` |

| `ams-api-novel` | `novel` | http://localhost:7002 | profile `novel` |

| `ams-agent-server` | `agent` | http://localhost:7003 | profile `agent` |

| `ams-postgres` | — | localhost:5432 | 多 database |

| `ams-redis` | — | localhost:6379 | Redis |



## Agent 运行时边界

```
前端 ──HTTP/SSE──► agent-server:7003（BFF + Pi）
                    └─ PostgreSQL（元数据）
```

Pi 工作区目录由**业务子应用**自带并挂载，不在仓库根配置。平台鉴权/菜单：`api-main:7001`（Egg.js）。

