# Agent 开发方案（Pi v3）

> **对齐参考**：[cartoon-agent](E:/AI_Projects/cartoon-agent) · [docs/ARCHITECTURE.md](E:/AI_Projects/cartoon-agent/docs/ARCHITECTURE.md)  
> **架构规则**：`.cursor/rules/app-self-contained.mdc` · **Pi 规则**：`pi-v3-agent.mdc`、`pi-minimal-design.mdc`

## 1. 定位

Agent **不是**仓库级独立服务，而是**需要 Pi 能力的子应用内置模块**（`{app}/agent/`），模式与 cartoon-agent 的 `server/`（BFF + Pi 单 Node 进程）一致，**非** Egg.js 内嵌、**非** Python 子进程。

| 模块 | 路径（小说子应用示例） | 技术 | 职责 |
|------|------------------------|------|------|
| 平台 BFF | `menu-master/backend/` | Egg.js | 菜单、鉴权、RBAC |
| 小说 BFF | `novel-sub/backend/` | Egg.js | 小说 CRUD |
| **Pi Agent** | **`novel-sub/agent/`** | **Node + Pi** | **对话 SSE、LLM、工作区、artifacts** |

前端在子应用内调用 `POST /api/chat`（默认 `:7003`）。

## 2. 拓扑（novel-sub 自包含）

```
novel-sub/frontend  ──HTTP/SSE──►  novel-sub/agent/ (:7003)
        │                                    │
        └── REST ──► novel-sub/backend (:7002)
                          │
                          └── novel-sub/deploy/postgres (novel_db)
```

与主应用集成时，主应用 Nginx 可将 `/agent-api/` 代理到子应用 Agent 容器。

## 3. Pi 工作目录（同应用内）

| 路径 | 说明 |
|------|------|
| `novel-sub/workspace-templates/novel/` | SOUL.md、AGENTS.md、tools/、*-format.md |
| `novel-sub/workspaces/` | 运行时复制（gitignore） |
| `novel-sub/data/` | artifacts JSON（gitignore） |

`agent/` 通过 `TEMPLATES_ROOT`、`WORKSPACES_ROOT`、`DATA_ROOT` 指向上述路径；Docker 见 `novel-sub/deploy/config/Dockerfile.agent`。

## 4. 逻辑子 Agent（agent_name）

**非独立进程**；Pi 在单轮内选择 `agent_name` + `message_type`（详见 `workspace-templates/novel/AGENTS.md`）。

| agent_name | 能力 |
|------------|------|
| novel_writer | 小说正文、扩写 |
| outline_planner | 大纲、卷章、任务列表 |
| genre_analyst | 类型分析 |
| scene_analyst | 场景环境 |
| character_analyst | 人物形象 |
| script_adapter | 剧本化 |
| storyboard_director | 分镜运镜 |
| prompt_engineer | 绘图/视频提示词 |

## 5. 消息管线

```
前端 → POST /api/chat → enrichMessage → runTurn(Pi) → outboxPersist → SSE
```

| 产物 | 职责 |
|------|------|
| `sessions/{id}/inbox.md` | BFF enrichment |
| `sessions/{id}/outbox.json` | Pi 契约；BFF persist |
| SSE `event: message` | 流式 reply + payload |

## 6. 核心 API

| 路径 | 说明 |
|------|------|
| `POST /api/chat` | 创作对话（SSE） |
| `GET /api/llm/profiles` | 模型下拉 |
| `GET /api/internal/**` | Pi tools 读本应用数据 |
| `GET /health` | 健康检查 |

## 7. 极简原则

详见 `.cursor/rules/pi-minimal-design.mdc`。

## 8. 本地开发

```bash
# 完整栈（推荐）
cd novel-sub/deploy && npm link && ams-novel local

# 宿主机热更新
ams-novel local:infra
cd novel-sub/backend && npm run dev    # :7002
cd novel-sub/frontend && npm run dev   # :5174
cd novel-sub/agent && npm run dev      # :7003
```

**无独立 `ams-agent` CLI** — Agent 随 `ams-novel` 启动。

## 9. 代码布局

```
novel-sub/
├── agent/src/
│   ├── index.ts
│   ├── agent/          # runTurn, agentManager, llmProfiles
│   └── bff/            # chat, llmOptions, internal, enrich, outboxPersist
├── workspace-templates/novel/
├── workspaces/         # gitignore
└── data/               # gitignore
```

## 10. 参考文档

- [cartoon-agent README](E:/AI_Projects/cartoon-agent/README.md)
- [私人管理平台主应用设计](./私人管理平台主应用设计.md)
