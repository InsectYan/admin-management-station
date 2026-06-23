# Agent 开发方案（Pi v3）

> **对齐参考**：[cartoon-agent](E:/AI Tools/projects/cartoon-agent) · [docs/ARCHITECTURE.md](E:/AI Tools/projects/cartoon-agent/docs/ARCHITECTURE.md)  
> **Cursor 规则**：`.cursor/rules/pi-v3-agent.mdc`、`.cursor/rules/pi-minimal-design.mdc`

## 1. 定位

私人管理平台采用 **微前端 + 多 BFF**；智能体能力单独成 **Agent Server**，模式与 cartoon-agent 的 `server/`（BFF + Pi 单 Node 进程）一致，**非** Egg.js 内嵌、**非** Python 子进程。

| 服务 | 技术 | 职责 |
|------|------|------|
| `apps/main-backend` | Egg.js | 菜单、鉴权、RBAC |
| `apps/novel-backend` | Egg.js | 小说 CRUD |
| **`apps/agent-server`** | **Node + Pi** | **对话 SSE、LLM、工作区、artifacts** |

前端可通过 Qiankun 子应用或主应用内嵌页调用 `POST /api/chat`。

## 2. 拓扑

```
React 创作/管理 UI
        │ HTTP / SSE
        ▼
apps/agent-server/（:7003）
  ├── BFF（enrichment、outboxPersist、llmProfiles）
  ├── Pi AgentManager（runTurn）
  └── internal API（tools 读平台数据）
        │
        └─► PostgreSQL（会话、消息元数据）
```

业务域 Pi 模板 / 工作区 / artifacts 目录挂载在**对应子应用包**内（见 §3），不由仓库根统一提供。

## 3. Pi 工作目录（子应用域内）

**不在 monorepo 根目录**维护 `workspace-templates/`、`workspaces/`、`data/`。各业务域在实现 Agent 能力时，于**该子应用目录**自建：

| 路径（示例 · 小说域） | 说明 |
|----------------------|------|
| `apps/novel/workspace-templates/` | 模板：SOUL.md、AGENTS.md、tools/、*-format.md |
| `apps/novel/workspaces/` | 运行时复制（gitignore） |
| `apps/novel/data/` | artifacts JSON（gitignore，可选） |

`agent-server` 通过 `TEMPLATES_ROOT`、`WORKSPACES_ROOT` 等环境变量指向上述路径；Compose 卷挂载写在该子应用或 `apps/agent-server` 的 compose 片段中。

首次对话从模板复制到 `workspaces/`，流程对齐 cartoon-agent `workspace-templates/creator/`。

## 4. 逻辑子 Agent（agent_name）

**非独立进程**；Pi 在单轮内选择 `agent_name` + `message_type`（详见该域子应用内 `workspace-templates/**/AGENTS.md`）。

与 cartoon-agent creator 域对齐的能力：

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
| `sessions/{id}/inbox.md` | BFF enrichment（含近期对话、当前项目） |
| `sessions/{id}/outbox.json` | Pi 必填契约；BFF 解析并 persist |
| SSE `event: message` | 流式 reply + 结构化 payload |

无 outbox 时：通用补写 + fallback（参考 cartoon-agent `creatorTurnFallback`）。

## 6. 核心 API

| 路径 | 说明 |
|------|------|
| `POST /api/chat` | 创作对话（SSE） |
| `GET /api/llm/profiles` | 模型下拉（Ollama / 云端） |
| `GET /api/internal/**` | Pi tools 读小说/项目 |
| `GET /health` | 健康检查 |

## 7. 极简原则（必守）

| 允许 | 禁止 |
|------|------|
| BFF 拼 context、校验 outbox 白名单 | TS 关键词硬编码 agent 路由 |
| Pi 读 inbox + format 文件决策 | LangGraph / Python Agent 子进程 |
| tools/*.mjs 调 internal API | Pi 直接写业务 PostgreSQL 表 |

详见 `.cursor/rules/pi-minimal-design.mdc`。

## 8. 与主应用集成

1. **菜单**：`menu_items` 增加 Agent 子应用项（`microapp_name` 如 `novel-agent-ui`）
2. **Qiankun**：子应用 entry 指向 Agent 对话 UI 静态资源
3. **代理**：主应用 Nginx `/agent-api/` → `agent-server:7003`
4. **鉴权**：主应用 JWT 透传或 Agent BFF 校验平台 token

## 9. 本地开发

```bash
# 全栈（含 agent-server 容器）
cd deploy && npm link && ams local

# 仅 DB，宿主机跑 agent-server 热更新
ams local:infra
cd apps/agent-server && npm run dev
```

## 10. 代码布局（规划）

```
apps/agent-server/src/
  index.ts
  agent/          # agentManager, runTurn, llmProfiles
  bff/routes/     # chat, llmOptions, internal
  bff/services/   # enrichMessage, outboxPersist, sseChatStream

# Pi 工作区（按业务域，在子应用目录内，非仓库根）：
apps/novel/workspace-templates/
apps/novel/workspaces/    # gitignore
apps/novel/data/          # gitignore，可选
```

## 11. 参考文档

- [cartoon-agent README](E:/AI Tools/projects/cartoon-agent/README.md)
- [creator-message-pipeline](E:/AI Tools/projects/cartoon-agent/docs/creator-message-pipeline.md)
- [私人管理平台主应用设计](./私人管理平台主应用设计.md) §4.6 AI Agent 集成
