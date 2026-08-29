# Agent 组件开发进度

> **状态**：A1–A9、B–E 向导五步、F 开书计划、G 列表/详情、H 多模态封面已落地  
> **设计真源**：[Agent设计/00-组件拆分.md](../Agent设计/00-组件拆分.md) · [02-表单AI坞.md](../Agent设计/02-表单AI坞.md) · [04-世界观.md](../Agent设计/04-世界观.md)

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
| 6 | **当时不做**：orchestrator、05～09 | 首批只打通「起个书名 → 对话修正 → 应用到 title」 |

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
| POST | `/api/ai/dispatch` | 按计划任务再调目标 feature 的 turns（不经 orchestrator 套 invoke） |
| PATCH | `/api/ai/sessions/:id` | 绑定 novel_id / 归档 |

前端只传 `scene`，不传 skill 名。未开放场景返回 **501**。世界观/人物/大纲/章节无 `novel_id` 返回 **400** `NOVEL_REQUIRED`。人物任务在世界观 `applied`/`skip` 前 dispatch 返回 **409** `DEPENDENCY_BLOCKED`。

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

- [x] `plugins/novel-writer-skill/`：`fill_basic` / `fill_world` / `fill_characters` / `fill_outline` / `fill_chapters` / `rewrite_field`
- [x] `plugins/novel-brainstorm-skill/`：`ideate`；basic.* pipeline 默认带上

**前端坞 + 步 1**

- [x] `AiFormDock` 竖栏（展开 ~320px / 折叠 ~64px）
- [x] `AiSceneTree` + `AiChatThread` + `useAiDock` / `aiService`
- [x] 创建步 1 插入基础信息 scenes（父卡 `basic` + 书名/立意/简介；类型/题材/篇幅/读者/节奏禁选）
- [x] 思考过程 SSE 流式展开，整轮结束后折叠
- [x] `@apply` merge 进 `basicForm` 并 `markDirty`；不自动保存
- [x] 无 `novel_id` 时可 turns；保存草稿后 PATCH session.novel_id

### 明确不做（仍排后面）

- 横栏 layout 切换、底栏浮层
- Skill 回写 novel_db

---

## 2.1 第二批：世界观（创建步 2）

- [x] registry：`world` + `world.era|geography|social|power|tech|history|timeline`
- [x] writer `fill_world`；`timeline` 仅 `year`+`event`；BFF sanitize
- [x] 步 2 挂同一 `AiFormDock`，`feature_key=world`；无草稿禁用并提示「请先保存基础信息」
- [x] 应用：文本覆盖，时间轴按 `year|event` 追加去重
- [x] 冒烟：无 `novel_id` 调 `world.power` → `NOVEL_REQUIRED`

---

## 2.2 第三批：人物（创建步 3）

- [x] registry：`characters` / `characters.cast` / `characters.edges` / `characters.current`
- [x] writer `fill_characters`；`role`/`relation` 白名单；非法边丢掉并写入 reply
- [x] 步 3 挂坞；无草稿禁用；选中角色显示「正在补全：{name}」
- [x] 应用：按 name/id 合并，默认不删已有角色；边把姓名解析成 id
- [x] 冒烟：无 `novel_id` 调 `characters.cast` → `NOVEL_REQUIRED`

---

## 2.3 第四批：大纲（创建步 4）

- [x] registry：`outline` / `outline.volumes` / `outline.words`
- [x] writer `fill_outline`；字数超出篇幅区间只 warning，不改数字
- [x] 步 4 挂坞；空树替换，已有卷按标题合并/追加
- [x] 冒烟：无 `novel_id` 调 `outline.volumes` → `NOVEL_REQUIRED`

---

## 2.4 第五批：内容组织（创建步 5）

- [x] registry：`content` / `content.chapters` / `content.faction` / `content.outline_ref`
- [x] writer `fill_chapters`；pipeline 仅 writer；`faction` 白名单；patch 不含 order
- [x] 步 5 挂坞；按 title 合并追加；只勾阵营时不改标题、不追加；snapshot 带当前 order
- [x] 冒烟：无 `novel_id` 调 `content.chapters` → `NOVEL_REQUIRED`

---

## 2.5 第六批：总任务拆分（列表 AI 开书）

- [x] `plugins/novel-orchestrator-skill/`：`plan` / `replan`；patch 只有 `tasks`，不写正文
- [x] registry `orchestrate.*`；无 novel_id 可 turns；sanitize 强制五步依赖
- [x] `POST /api/ai/dispatch`：再调目标 feature turns；人物在世界观完成前 409
- [x] 列表「AI 开书」Dialog；「执行下一步」先跑 `fill_basic` 并建草稿
- [x] 冒烟：orchestrate 不 501；dispatch 无计划 → `PLAN_REQUIRED`

---

## 2.6 第七批：列表与详情

- [x] 编辑弹窗底部折叠坞，`feature_key=basic` 与向导共享会话；应用只改弹窗表单，未点保存列表不变
- [x] 详情每模块「用 AI 补全」→ `/novels/create?id=&step=&ai=1`，坞展开不自动发送
- [x] 「补全全部缺口」→ `?ai=plan` 打开计划坞
- [x] 无新 BFF / Skill（开书走 08，快编走 basic turns）

---

## 3. 建议开发顺序

向导 + 开书 + 列表/详情 + 封面出图已齐。余下：横栏坞、Skill 回写 novel_db。冒烟：`cd backend && npm run agent:smoke`。

---

## 4. 首批验收

- [ ] 前端 Network 无直连 `:4001`
- [ ] 只勾「小说名称」时 patch 不含立意
- [ ] 未点「应用到表单」时保存草稿 title 不变
- [ ] 应用后 title 进输入框，dirty，再保存才入库
- [ ] Agent 关闭：坞有错误提示，表单仍可手填
- [ ] `GET /api/plugins` 含 `novel-writer-skill` 与 `novel-brainstorm-skill`

### 4.1 世界观验收

- [ ] 未保存草稿进入步 2：坞提示「请先保存基础信息」，不能发送
- [ ] 只选「力量体系」时应用不改 timeline 和其他文本
- [ ] 时间轴默认追加，条数增加；相同 year+event 不重复
- [ ] 保存设定后才写入 `PUT /setting` 的 world 块

### 4.2 人物验收

- [ ] 未保存草稿进入步 3：坞提示「请先保存基础信息」
- [ ] 已有 2 人时「再补一个反派」应用后人数 +1，原角色仍在
- [ ] 非法 relation 被丢掉，reply 有说明
- [ ] 关系图能画出新边（source/target 对得上）

### 4.3 大纲验收

- [ ] 空大纲应用后至少 1 卷 1 组 1 节
- [ ] 已有卷默认按标题合并/追加，不整树清空
- [ ] 字数超出篇幅区间时 reply 有警告，仍可保存

### 4.4 内容组织验收

- [ ] 应用后可继续拖拽，保存顺序稳定
- [ ] 只勾选阵营时不改标题、不追加新章
- [ ] 非法 faction 被丢掉，reply 有说明

### 4.5 总任务拆分验收

- [ ] 计划里人物任务在世界观 `applied`/`skip` 前不能 dispatch
- [ ] 执行基础信息后列表出现草稿，会话补上 `novel_id`
- [ ] orchestrator 响应不含大段设定正文
- [ ] `GET /api/plugins` 含 `novel-orchestrator-skill`

### 4.6 列表与详情验收

- [ ] 详情页 Network 无直连 `:4001`
- [ ] 补全跳转后 `?ai=1` 坞展开，表单仍是已保存数据
- [ ] 快编应用后未点弹窗保存，列表数据不变

### 4.7 封面与多模态

- [ ] 侧栏「多模态」每项可见文生图/文生视频能力标签
- [ ] 创建步 1 / 快编「AI 生成封面」走 `POST /api/ai/cover/generate`，Network 无直连 `:4001`
- [ ] 封面不经过 writer；未点保存列表 `cover_url` 不变
- [ ] 选中仅视频模型时出图返回 `MEDIA_MODALITY_UNSUPPORTED`

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
| B1 | registry world.* + 无 novel_id 拒绝 | 完成 |
| B2 | writer fill_world + timeline sanitize | 完成 |
| B3 | 创建步 2 坞 + 禁发 + 时间轴追加 | 完成 |
| B4 | 冒烟 world.power → NOVEL_REQUIRED | 完成 |
| C1 | registry characters.* + 无 novel_id 拒绝 | 完成 |
| C2 | writer fill_characters + role/relation 白名单 | 完成 |
| C3 | 创建步 3 坞 + 按名合并 + 当前角色提示 | 完成 |
| C4 | 冒烟 characters.cast → NOVEL_REQUIRED | 完成 |
| D1 | registry outline.* + 无 novel_id 拒绝 | 完成 |
| D2 | writer fill_outline + 字数 warning | 完成 |
| D3 | 创建步 4 坞 + 空树替换/已有追加 | 完成 |
| D4 | 冒烟 outline.volumes → NOVEL_REQUIRED | 完成 |
| E1 | registry content.* + 无 novel_id 拒绝 | 完成 |
| E2 | writer fill_chapters + faction 白名单、无 order | 完成 |
| E3 | 创建步 5 坞 + 按标题合并 + 阵营不改标题 | 完成 |
| E4 | 冒烟 content.chapters → NOVEL_REQUIRED | 完成 |
| F1 | novel-orchestrator-skill 只出 tasks | 完成 |
| F2 | registry orchestrate.* + dispatch 依赖闸门 | 完成 |
| F3 | 列表 AI 开书 Dialog + 执行下一步建草稿 | 完成 |
| F4 | 冒烟 orchestrate 开放、dispatch PLAN_REQUIRED | 完成 |
| G1 | 编辑弹窗底部折叠坞，共享 basic 会话 | 完成 |
| G2 | 快编 apply 不写列表，需点保存 | 完成 |
| G3 | 详情「用 AI 补全」跳向导 ?ai=1 展开坞 | 完成 |
| G4 | 「补全全部缺口」?ai=plan | 完成 |
| H1 | Agent media catalog + `/api/media/profiles` `/generate` | 完成 |
| H2 | 主应用侧栏多模态选项（能力标签、全局 sessionStorage） | 完成 |
| H3 | 封面 generate 走 media_profile，不走 writer | 完成 |
| H4 | 规范 `media-model.mdc`：非文本一律该选项 | 完成 |
