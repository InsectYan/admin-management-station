# Agent 组件开发进度

> **状态**：首批 A1–A9 已落地（会话表 + turns/SSE + writer/brainstorm + 竖栏坞 + 结构化选项禁选）  
> **设计真源**：[Agent设计/00-组件拆分.md](../Agent设计/00-组件拆分.md) · [02-表单AI坞.md](../Agent设计/02-表单AI坞.md) · [01-会话与上下文.md](../Agent设计/01-会话与上下文.md)

---

## 0. 结论：Agent 从哪里开始

**不要先做 orchestrator，也不要先铺世界观/人物。**

| 顺序 | 做什么 | 原因 |
|------|--------|------|
| 1 | 小说 BFF：会话表 + **唯一 turns 入口** + `agentProxy` | 业务增删改查在小说服务端；后面所有场景都走这一条 |
| 2 | BFF `aiSceneRegistry`：用 `scene` 字符串分发到 Skill | 「一个接口拆分场景」，前端不传 skill 名 |
| 3 | **Agent 第一刀：`novel-writer-skill`**（`scheme: loop`） | 能产出可 `apply` 的 `patch`，坞才能闭环 |
| 4 | 前端：竖栏坞 + 创建步 1 插入 `scenes[]` | 对得上 02；先挂基础信息 |
| 5 | （同批）`novel-brainstorm-skill` | 书名/立意第一道火花；registry 里 `pipeline: [brainstorm, writer]` |
| 6 | **不做**：orchestrator、04～09 | 首批只打通「起个书名 → 对话修正 → 应用到 title」 |

工作区 **没有** `agent-management-sub`。Skill 在 `agent-management-master/plugins/`。

```text
创建页坞  --scene=basic.title-->  POST /api/ai/sessions/:id/turns/stream
                                      │
                                      ├─ 会话/消息 CRUD → novel_db
                                      ├─ registry[scene] → skill + action + pipeline
                                      └─ agentProxy → :4001 POST /api/skills/:name/invoke-stream
                                              └─ novel-brainstorm-skill → novel-writer-skill
```

---

## 1. 两条原则怎么落地

### 1.1 业务 CRUD 只在小说 BFF

| 放 novel-sub | 不放 Agent Skill |
|--------------|------------------|
| `novel_ai_sessions` / `novel_ai_messages` 的增删改查 | 对话历史、applied 标记 |
| 现有 `POST/PUT /api/novels`（用户点保存草稿才写小说） | 禁止 Skill 直写 `novel_db` |
| `POST .../apply` 只改 message.applied | 禁止 turns 里自动 PUT 小说 |

### 1.2 一个接口，按 scene 拆 Agent

| 方法 | 路径 | 职责 |
|------|------|------|
| GET/POST | `/api/ai/sessions` | 会话列表 / 新建 |
| GET | `/api/ai/sessions/:id/messages` | 对话回放 |
| **POST** | **`/api/ai/sessions/:id/turns`** | JSON 生成入口（冒烟） |
| **POST** | **`/api/ai/sessions/:id/turns/stream`** | **坞内生成入口（SSE 思考流）** |
| POST | `/api/ai/sessions/:id/apply` | 标记已应用到表单 |
| PATCH | `/api/ai/sessions/:id` | 绑定 novel_id / 归档 |

前端只传 `scene`，不传 skill 名。未开放场景（如 `world`）返回 **501**。

---

## 2. 首批范围

### 包含

**小说 BFF**

- [x] migration `003_novel_ai_sessions.sql` + `init.sql` + Model + schemaSync
- [x] `config.agentPlatform.baseUrl`（默认 `http://127.0.0.1:4001`）
- [x] `lib/agentProxy.js`：通用 `invokeSkill`
- [x] `lib/aiSceneRegistry.js` + `service/aiTurn.js` + `controller/aiSession.js`
- [x] 路由挂上 §1.2 五条
- [x] `.env.example`：`AGENT_PLATFORM_URL`
- [x] 冒烟：`backend/scripts/agent-linkage-smoke.js`

**Agent**

- [x] `plugins/novel-writer-skill/`：`fill_basic` / `rewrite_field`，出参 `thinking` / `reply` / `patch`
- [x] `plugins/novel-brainstorm-skill/`：`ideate`；basic.* pipeline 默认带上

**前端坞 + 步 1**

- [x] `AiFormDock` 竖栏（展开 ~320px / 折叠 ~64px）
- [x] `AiSceneTree` + `AiChatThread` + `useAiDock` / `aiService`
- [x] 创建步 1 插入基础信息 scenes（父卡 `basic` + 书名/立意/简介；类型/题材/篇幅/读者/节奏禁选）
- [x] 思考过程 SSE 流式展开，整轮结束后折叠
- [x] `@apply` merge 进 `basicForm` 并 `markDirty`；不自动保存
- [x] 无 `novel_id` 时可 turns；保存草稿后 PATCH session.novel_id

### 明确不做（二期）

- 横栏 layout 切换、底栏浮层
- 世界观及以后 scenes、人物/大纲/章节
- `novel-orchestrator-skill`、列表「AI 开书」
- Skill 回写 novel_db、封面生成

---

## 3. 建议开发顺序

已按 A1→A7 做完。重启 Agent `:4001` 后 `GET /api/plugins` 应含两个 novel skill。冒烟：`cd backend && npm run agent:smoke`。

---

## 4. 首批验收

- [ ] 前端 Network 无直连 `:4001`
- [ ] 只勾「小说名称」时 patch 不含立意
- [ ] 未点「应用到表单」时保存草稿 title 不变
- [ ] 应用后 title 进输入框，dirty，再保存才入库
- [ ] Agent 关闭：坞有错误提示，表单仍可手填
- [ ] `GET /api/plugins` 含 `novel-writer-skill` 与 `novel-brainstorm-skill`

---

## 5. 进度勾选

| ID | 项 | 状态 |
|----|----|------|
| A1 | 会话表 + Model + 路由 CRUD | 完成 |
| A2 | agentProxy + sceneRegistry + turns | 完成 |
| A3 | novel-writer-skill | 完成 |
| A4 | 冒烟脚本 | 完成 |
| A5 | AiFormDock 竖栏 + 场景卡 + 对话 | 完成 |
| A6 | 创建步 1 闭环 | 完成 |
| A7 | novel-brainstorm-skill | 完成 |
| A8 | turns SSE 流式思考 + 结束后折叠 | 完成 |
| A9 | 结构化选项卡禁止选择、AI 不生成枚举字段 | 完成 |
