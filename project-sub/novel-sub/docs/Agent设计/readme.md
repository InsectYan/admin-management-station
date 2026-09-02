# 小说平台 Agent 设计

> **版本**：v0.1 · 2026-08-28  
> **状态**：首批代码已落地（会话 + turns + writer/brainstorm + 创建步 1 竖栏坞）；orchestrator / 世界观及以后仍为设计稿  
> **产品入口**：[小说平台Agent.md](../../../../docs-project/小说平台Agent.md)（原文为空，已按现网页面重建）  
> **规范**（相对本文件 `docs/Agent设计/`，需连跳四级到 AMS 根、五级到 `projects/`）：
> - [agent-management-master/README.md](../../../../../agent-management-master/README.md)（新增 Skill / 方案）
> - [主应用完整开发方案.md](../../../../../agent-management-master/docs-design/主应用完整开发方案.md) §5 Skill 契约 · §6 统一流水线
> - [schemes/README.md](../../../../../agent-management-master/docs/schemes/README.md)（loop / react）
> - [api/README.md](../../../../../agent-management-master/docs/api/README.md)（`POST /api/skills/:name/invoke`）
> - AMS [agent-skill-development.mdc](../../../../.cursor/rules/agent-skill-development.mdc)、[subapp-development.mdc](../../../../.cursor/rules/subapp-development.mdc) §4
>
> | 文档 | 实际位置（相对 `e:\AI Tools\projects`） |
> |------|----------------------------------------|
> | 产品入口 | `admin-management-station/docs-project/小说平台Agent.md` |
> | Agent 主仓 README | `agent-management-master/README.md` |
> | Skill 契约 / 统一流水线 | `agent-management-master/docs-design/主应用完整开发方案.md` |
> | scheme 说明 | `agent-management-master/docs/schemes/README.md` |
> | 调用 API | `agent-management-master/docs/api/README.md` |
> | Skill 落点规则 | `admin-management-station/.cursor/rules/agent-skill-development.mdc` |
> | 子应用变更规范 | `admin-management-station/.cursor/rules/subapp-development.mdc` |

**明细（三端方案，一组件一文件）**：从 [00-组件拆分.md](./00-组件拆分.md) 进入。主交互已改为 **表单底部 AI 坞 + 本次主题 Tab + 会话落库**，不再按字段做独立聊天框。

| 文件 | 内容 |
|------|------|
| [00-组件拆分.md](./00-组件拆分.md) | 拆了哪些、共用关系、开发顺序 |
| [01-会话与上下文.md](./01-会话与上下文.md) | 建表、思考过程、会话组 |
| [02-表单AI坞.md](./02-表单AI坞.md) | 共用前端壳 |
| [03](./03-基础信息.md)～[07](./07-内容组织.md) | 向导各步（07 现为章节目录） |
| [10](./10-门派组织.md) · [11](./11-单章开发.md) | 门派组织；详情专属单章正文 |
| [08-总任务拆分.md](./08-总任务拆分.md) | AI 开书 |
| [09-列表与详情.md](./09-列表与详情.md) | 快编 / 详情入口 |
| [SKILL-头脑风暴.md](./SKILL-头脑风暴.md) · [结构化生成](./SKILL-结构化生成.md) · [任务拆分](./SKILL-任务拆分.md) | Agent 插件 |

---

## 0. 设计结论（先读）

| 决策 | 选择 | 原因 |
|------|------|------|
| 前端 AI 组件数量 | **1 个坞 + 各步 `scenes[]`** | 默认竖栏贴左侧菜单；场景卡父/子数据插入；对话多轮修正。见 [02-表单AI坞](./02-表单AI坞.md) |
| Skill 数量 | **3 个**（brainstorm + writer + orchestrator） | 头脑风暴作第一道（书名/立意/人物火花复用）；writer 收成表单 JSON；orchestrator 只出 plan |
| 谁执行 plan | **novel-sub BFF 串行 invoke** | 平台主 Agent 只做 scheme 调度；Skill 套 Skill 易超时，对齐 testgen 的 BFF 编排 |
| 落库时机 | **用户确认后再写** | AI 输出先进入建议抽屉/计划坞，再 `PUT` 现有 novels API |
| LLM 位置 | **禁止**写进 novel-sub BFF | BFF 只做 `agentProxy` + 审计 + 枚举注入 |

`docs-project/小说平台Agent.md` 原先为空。下文以现网三页（列表 / 创建五步 / 详情）和 `novelCreateSchema.js` 为真源。

---

## 1. 总任务拆分 Agent 与其他角色

`agent-management-master` 里有两套容易混淆的「编排」：

```
┌─────────────────────────────────────────────────────────────────┐
│  平台主 Agent（agent-management-master :4001）                     │
│  RouteManager → resolveLlm → SchemeRegistry.executeTask          │
│  职责：怎么跑（pi / loop / react），不懂「写一本玄幻小说」         │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/skills/:name/invoke
┌────────────────────────────▼────────────────────────────────────┐
│  业务拆分 Skill：novel-orchestrator-skill  scheme=loop            │
│  职责：看现有草稿缺口 → 产出 plan[]（对齐五步）→ 不写正文         │
└────────────────────────────┬────────────────────────────────────┘
                             │ plan.tasks[].action
                             │ BFF 串行转发（禁止 Skill 内递归 invoke）
┌────────────────────────────▼────────────────────────────────────┐
│  领域生成 Skill：novel-writer-skill  scheme=react（短）/ loop（长）│
│  职责：按 action 产出对齐表单 schema 的 JSON                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 角色对照

| 角色 | 仓库 | 是什么 | 不是什么 |
|------|------|--------|----------|
| **平台主 Agent** | `agent-management-master` | 插件加载、scheme 执行、LLM 三级优先级、记忆、审计路由 | 小说业务编排器 |
| **总任务拆分** `novel-orchestrator-skill` | `agent-management-sub/plugins/` | 把用户意图 + 当前 `setting_json` 拆成有序子任务 | 不生成书名/人物/大纲正文 |
| **领域生成** `novel-writer-skill` | 同上 | `fill_basic` / `fill_world` / `fill_characters` / `fill_outline` / `fill_chapters` / `rewrite_field` | 不决定「下一步该做哪步」 |
| **BFF 网关** | `novel-sub/backend` | `agentProxy`、注入枚举 catalog、按 plan 串行调用、审计、可选落库 | 不含 LLM SDK / MCP / Loop |
| **前端** | `novel-sub/frontend` | 4 个 AI 组件 + 现有表单 | 禁止直连 `:4001` |

平台 §6「主 Agent 对所有 Skill 使用统一编排」只保证 **HTTP 流水线一致**。小说的「先世界观后人物后大纲」属于 **业务 plan**，必须放在 orchestrator + BFF，不能写进新 scheme。

### 1.2 依赖顺序（orchestrator 必须遵守）

```text
fill_basic
  → fill_world          （需要类型/题材/立意）
  → fill_characters     （需要世界观约束）
  → fill_outline        （需要人物冲突）
  → fill_chapters       （需要大纲节点做 outline_ref）
```

规则：

1. 已有步骤有内容 → plan 里标 `status: skip` 或 `status: optional_rewrite`，默认不覆盖。
2. 用户在步骤 3 点「生成本步」→ BFF **只 invoke** `fill_characters`，不跑全量 plan。
3. 列表「AI 开书」→ 先 `plan`（可只含 `fill_basic`），建草稿后再按用户确认逐步 dispatch。
4. writer **不得**回调 orchestrator；单向委托。

### 1.3 调用时序

**A. 一句话开书（总任务）**

```text
列表「AI 开书」
  → POST /api/ai/plan { intent, enum_catalog }
  → orchestrator Loop: inspect → plan → review
  → 返回 { novel_seed?, tasks[] }
  → 前端 AiPlanDock 展示任务卡
  → 用户点「执行下一步」
  → POST /api/ai/dispatch { novel_id, task_id }
  → BFF invoke writer(action=task.action, context=已保存设定)
  → AiSuggestDrawer 预览 → 用户应用 → 现有 PUT /api/novels 或 /setting
```

**B. 当前步骤（局部）**

```text
创建页步骤 N「生成本步」
  → POST /api/ai/assist { novel_id, action: fill_*, current_form, enum_catalog }
  → BFF 直接 invoke writer（不经 orchestrator）
  → 抽屉预览 → 应用本步表单（dirty=true，仍走向导保存）
```

**C. 单字段**

```text
字段旁 AiAssistTrigger
  → POST /api/ai/assist { action: rewrite_field|expand_field|suggest_enum, path, value }
  → writer 短步 react
  → Popover/抽屉 应用该 path
```

### 1.4 反模式（对齐主仓 §5.6）

- 在 writer 里按 `scheme` 写大段分支（应换 scheme 或收紧 callbacks）
- BFF 用关键词做意图路由（「用户说了大纲就调 fill_outline」）——意图由 orchestrator 或前端显式 `action` 给出
- Skill 读 env 里的 apiKey（必须走平台 `resolveLlm`）
- 前端直连 Agent 平台
- 在 `novel-sub` 内嵌 Loop / MCP / LLM SDK

---

## 2. 现网页与表单盘点

### 2.1 路由与页面

| 路由 | 页面 | 现有能力 | AI 切入点 |
|------|------|----------|-----------|
| `/novels` | `NovelListPage` | 看板/表格、筛选、新建、编辑弹窗、删除 | 工具栏「AI 开书」；空状态引导 |
| `/novels/create` | `NovelCreatePage` 五步向导 | 草稿 `?id=`、`?step=`，分步保存 | 步骤条 + 每字段 |
| `/novels/:id` | `NovelDetailPage` 五 Tab 只读 | 继续创作跳向导 | 「补全设定」「设定体检」 |
| 列表内 | `NovelEditDialog` | 基础字段快编 | 简介/题材/类型 AI |

详情页与创建步 1–5 字段同源，AI 组件只读模式下改为「生成后去向导应用」。

### 2.2 步骤 1 基础信息（`StepBasicInfo` + `createBasicInfoForm`）

| 字段 | 控件 | AI | 共用组件 | writer action |
|------|------|----|----------|---------------|
| `title` | 输入 | 生成 / 改写 | Trigger | `fill_basic` 或 `rewrite_field` |
| `creative_intent` | 多行 | 生成 / 扩写 | Trigger | 同上 |
| `genre_path` | 级联（枚举） | 建议一级+二级 | Trigger | `suggest_enum` / `fill_basic` |
| `length_id` | 下拉 | 随立意建议 | Trigger | `suggest_enum` |
| `theme_ids` | 多选 | 建议 3～8 个 id | Trigger | `suggest_enum` |
| `summary` | 多行 | 生成 / 扩写 | Trigger | `rewrite_field` |
| `audience_id` | 下拉 | 建议 | Trigger | `suggest_enum` |
| `update_pace_id` | 下拉 | 建议 | Trigger | `suggest_enum` |
| `author_name` | 输入 | **不接 AI** | — | 用户自己填 |
| `cover_url` | 输入 | **本期不接**（无出图链路） | — | P2 |
| 本步全部 | — | 一键生成本步 | `AiStepAssistBar` | `fill_basic` |

`fill_basic` 必须在 `enum_catalog` 内选 `genre_category_id` / `genre_subcategory_id` / `theme_ids` / `length_id` / `audience_id` / `update_pace_id`，禁止编造枚举名当 id。

### 2.3 步骤 2 世界观（`StepWorldSetting` + `WorldTimeline`）

| 字段 | AI | action |
|------|----|--------|
| `era` / `geography` / `social_rules` / `power_system` / `technology` / `history_notes` | 生成 / 扩写 / 改写 | `fill_world` 或 `expand_field` |
| `timeline[].year` + `event` | 批量生成节点 | `fill_world`（含 timeline） |
| 本步全部 | 一键生成本步 | `AiStepAssistBar` → `fill_world` |

### 2.4 步骤 3 人物（`CharacterLibrary` + `CharacterCard` + `CharacterRelationGraph`）

| 字段 | AI | action |
|------|----|--------|
| 角色库批量（主角/配角/反派） | 生成一组卡 | `fill_characters` |
| `name` / `role` / `personality` / `background` / `goal` / `relations` | 单卡补全 | `rewrite_field`（path 含 character id） |
| `character_edges` | 按已有角色建议边 | `fill_characters` 的 `edges` 段 |
| 本步全部 | 一键生成本步 | `AiStepAssistBar` |

`role` 只能是 `main` / `support` / `villain`；边 `relation` 只能是 `ally` / `enemy` / `mentor` / `family` / `love`。

### 2.5 步骤 4 大纲（`OutlineTree`）

| 字段 | AI | action |
|------|----|--------|
| `volumes[]` 卷/章组/小节标题 | 按篇幅生成树 | `fill_outline` |
| `word_target` | 按 `length_id` 字数区间拆分 | 含在 `fill_outline` |
| 本步全部 | 一键生成本步 | `AiStepAssistBar` |

### 2.6 步骤 5 内容组织（`ChapterTagList`）

| 字段 | AI | action |
|------|----|--------|
| `chapters[].title` | 按大纲小节生成 | `fill_chapters` |
| `faction` | `hero` / `villain` / `neutral` | 含在 `fill_chapters` |
| `outline_ref` | 指向大纲节点 id 或标题 | 含在 `fill_chapters` |
| `order` | 不由 AI 决定 | 前端按数组下标重算 |
| 本步全部 | 一键生成本步 | `AiStepAssistBar` |

拖拽排序保持现有 Sortablejs，AI 只出初始列表。

### 2.7 列表筛选 / 进度

筛选条件、`progress_status`、`progress_percent` **不接生成**。详情底部进度条仍是人工。`novel-review-skill`（P2）只出体检报告，不改进度。

---

## 3. 前端 AI 组件（4 个，全站共用）

路径建议：`frontend/src/components/novel/ai/`。不按步骤拆组件。

### 3.1 `AiAssistTrigger.vue` — 字段入口

**用在**：所有「要 AI」的表单项 label 右侧；编辑弹窗简介/题材；人物卡每个文本域。

| Prop | 说明 |
|------|------|
| `path` | JSON Pointer，如 `basic.title`、`world.era`、`characters[c_xxx].goal` |
| `mode` | `generate` \| `expand` \| `rewrite` \| `enum` |
| `action` | 覆盖默认 writer action |
| `disabled` | 未保存草稿（无 `novel_id`）时：步骤 1 允许只带本地 form；步 2+ 提示先保存 |

交互：点击 → 打开 `AiSuggestDrawer`（或短文本用 Popover）。加载中按钮 spinning，失败 ElMessage。

### 3.2 `AiSuggestDrawer.vue` — 建议预览（唯一应用出口）

**用在**：Trigger、StepBar、PlanDock 都把结果丢进这里。

| 能力 | 说明 |
|------|------|
| 原文 vs 建议 | 文本字段左右对比；树/数组用 JSON 摘要 + 「替换本步 / 合并追加」 |
| 枚举 | 展示 catalog 中的名称，写入仍是 id |
| 操作 | 应用全部、按 path 勾选应用、复制、丢弃 |
| 应用后 | `emit('apply', patch)`，由向导 composable 写入 form 并 `markDirty`，**不直接调 API** |

约束：应用不等于保存。用户仍点「保存草稿 / 下一步」。

### 3.3 `AiStepAssistBar.vue` — 本步一键

**用在**：`NovelCreateShell` 标题行或 `NovelCreateFooter` 左侧。

| Prop | 说明 |
|------|------|
| `step` | 1～5，映射 `fill_basic` … `fill_chapters` |
| `hasDraft` | 步 2+ 无 id 时禁用 |

文案示例：「生成本步设定」。二次确认：「将覆盖本步未勾选保留的空字段；已填字段默认保留」。

详情页五个 Tab 可放只读条：「用 AI 补全此模块」→ 跳转 `/novels/create?id=&step=` 并带 `ai=1` 自动打开本步生成。

### 3.4 `AiPlanDock.vue` — 总任务拆分坞

**用在**：列表「AI 开书」弹层；创建页右侧可折叠坞（有进行中的 plan 时显示）。

| 区块 | 说明 |
|------|------|
| 意图输入 | 一句话 + 可选类型/篇幅（可先不选，交给 plan） |
| 任务卡 | 对应五步，状态 `pending / running / preview / applied / skipped` |
| 依赖提示 | 未完成 `fill_world` 时禁用 `fill_characters` |
| 执行 | 「执行下一步」→ dispatch → 结果进 Drawer → 应用后任务变 applied |
| 中止 | 取消剩余 pending，已应用的数据保留 |

列表空状态：「用一句话开一本新书」打开同一 Dock。

### 3.5 页面挂载一览

| 页面 | Trigger | Drawer | StepBar | PlanDock |
|------|---------|--------|---------|----------|
| 列表 | 编辑弹窗简介/题材 | 全局 1 个 | — | 「AI 开书」 |
| 创建步 1～5 | 各文本/枚举字段 | 全局 1 个 | 每步 1 个 | 有 plan 时 |
| 详情 | — | — | Tab 上「补全」跳向导 | 「补全全部缺口」 |

不新增第五个聊天机器人。自由文本意图只进 PlanDock 的意图框。

---

## 4. Skill 设计

默认源码：`agent-management-sub/plugins/`，运行时挂到 `agent-management-master`（`PLUGIN_DIR` 或 symlink）。当前工作区若尚无 `agent-management-sub`，Phase 0 先在 master `plugins/` 落地，再按规范迁到 sub 仓。

### 4.1 `novel-orchestrator-skill`

| 项 | 值 |
|----|----|
| `scheme` | `loop` |
| `maxSteps` | 3：`inspect` → `plan` → `review` |
| 路由 | `POST /api/skills/novel-orchestrator-skill/invoke` |

**actions**

| action | 入参 | 出参 |
|--------|------|------|
| `plan` | `intent`，`novel_snapshot`（可空），`enum_catalog` | `tasks[]`，`rationale` |
| `replan` | 现有 plan + 用户跳过/失败的 task | 新 `tasks[]` |

**task 结构**

```json
{
  "id": "t_world",
  "step": 2,
  "action": "fill_world",
  "skill": "novel-writer-skill",
  "depends_on": ["t_basic"],
  "reason": "世界观为空",
  "status": "pending"
}
```

callbacks：`enrichContext` 只拼 snapshot 摘要与枚举短表；`persistResult` 可选写 `novel_ai_plans`（见 §6）。**不在 Skill 内 HTTP 调 writer。**

### 4.2 `novel-writer-skill`

| 项 | 值 |
|----|----|
| `scheme` | 默认 `react`，`maxSteps ≤ 2`；`fill_characters` / `fill_outline` 若超长可升 `loop` |
| 路由 | `POST /api/skills/novel-writer-skill/invoke` |

**actions**

| action | 输出对齐 |
|--------|----------|
| `fill_basic` | `basicFormToPayload` 形状 + 枚举 id |
| `fill_world` | `createWorldForm()` |
| `fill_characters` | `{ characters, character_edges }` |
| `fill_outline` | `{ volumes }` |
| `fill_chapters` | `{ chapters }`（不含 order，前端重排） |
| `rewrite_field` | `{ path, value }` |
| `expand_field` | `{ path, value }` |
| `suggest_enum` | `{ path, ids[] }` 且 id ∈ catalog |

`enrichContext` 注入：当前步骤已填内容、前序设定摘要、枚举 catalog、篇幅字数上下限。`jsonSchemaHint` 锁死字段名，与 `novelCreateSchema.js` 一致。

### 4.3 P2 `novel-review-skill`（本期不实现）

`scheme: react`，action `check_consistency`：人物是否违反力量体系、大纲是否丢掉主角、章节 `outline_ref` 是否悬空。只出报告，不写库。详情页入口预留。

### 4.4 最小交付物（每个 Skill）

```text
plugins/novel-orchestrator-skill/
  index.js
  SKILL.md
  templates/loop-system.md
  db/init.sql          # 若落 plan 表

plugins/novel-writer-skill/
  index.js
  SKILL.md
  templates/react-system.md
  lib/schemaHints.js   # 与前端 schema 字段名对照，禁止漂移
```

---

## 5. BFF 与数据

前端禁止直连 Agent。novel-sub 增加代理，**写库仍走现有 novels API**。

### 5.1 新增 API（规划）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/plan` | orchestrator `plan`；可无 `novel_id` |
| POST | `/api/ai/dispatch` | 按 `task_id` invoke writer；需 `novel_id`（步 1 可先 create） |
| POST | `/api/ai/assist` | 直接 writer（步骤/字段） |
| GET | `/api/ai/jobs/:id` | 可选：异步任务状态（Phase 2） |

`agentProxy.invokeSkill(path, { action, ... })` 对齐 testgen。配置：`config.default.js` 的 `agentPlatform.baseUrl`（默认 `http://127.0.0.1:4001`）。

每次调用带 `trace_id`、`novel_id`；失败对前端 fail，禁止静默空填。

### 5.2 枚举注入

BFF 在 invoke 前拉取 `GET` 已有 `/api/novel-enums`，写入 payload `enum_catalog`。writer 只许返回 catalog 内 id。校验失败则 422，不落建议。

### 5.3 可选表 `novel_ai_plans`（Phase 1 再加）

| 列 | 用途 |
|----|------|
| `id` | 计划 id |
| `novel_id` | 可空（开书尚未 create） |
| `intent` | 用户原话 |
| `tasks_json` | plan |
| `status` | drafting / running / done / cancelled |

一期可用内存/前端 state 扛 plan，不建表。建表时走 `database/init.sql` + migration + Model，遵守 schema 同步规范。

Agent 侧 Skill 表（run 记录）放 Skill `db/init.sql`，由 master `dbManager` 同步，**不要**写进 `novel_db`。

---

## 6. 功能向导（给使用者）

### 6.1 从零开书

1. 列表点 **AI 开书**。
2. 用一句话说类型、读者、核心冲突（例：「男频东方玄幻，凡人流，反派是宗门执事」）。
3. 坞中出现五张任务卡。先执行「基础信息」，抽屉里核对书名/立意/类型。
4. **应用**后进入创建向导步骤 1，再点保存草稿（或 dispatch 时 BFF 已 create）。
5. 依次执行世界观 → 人物 → 大纲 → 章节；随时跳过。
6. 每步仍可手改，再保存。

### 6.2 只补当前步

1. 打开已有草稿，停在某步。
2. 点 **生成本步设定**。已填字段默认保留空位给 AI。
3. 抽屉勾选要写入的块，应用后继续下一步。

### 6.3 只改一句话

1. 点字段旁 **AI**。
2. 选生成 / 扩写 / 改写。
3. 预览后应用，该字段变 dirty，保存草稿才持久化。

### 6.4 详情页

1. **补全设定**：跳到向导对应步并打开 StepBar。
2. **补全全部缺口**（有 plan）：打开 PlanDock，只对空模块 dispatch。
3. 设定体检为 P2，本期不做。

### 6.5 失败与边界

| 情况 | 行为 |
|------|------|
| Agent `:4001` 未启动 | 按钮可点，提示「智能服务不可用」 |
| 步 2+ 无草稿 id | StepBar 禁用，「请先保存基础信息」 |
| 枚举 id 非法 | 不应用，提示重新生成 |
| 用户离开有 dirty | 沿用现有离开确认，含未应用的 AI 草稿则先提示丢弃建议 |

---

## 7. 开发计划

对齐 testgen：先 BFF 网关与联调，再 Skill，再前端组件，最后挂页面。

### Phase 0 — 基建（P0）

| # | 任务 | 路径 |
|---|------|------|
| 0.1 | `agentPlatform` 配置 + `.env.example` | `backend/config/config.default.js` |
| 0.2 | `service/agentProxy.js`（invoke + 超时；Ollama 长超时） | 参考 testgen |
| 0.3 | `service/agentAudit.js` 或最小日志表 | 可选一期打日志文件 |
| 0.4 | 路由 `POST /api/ai/assist` 先打通 writer 冒烟 | `controller` + `router.js` |
| 0.5 | `docs/设计-Agent联调配置.md`（端口 4001 / 5201） | 新建 |
| 0.6 | 冒烟脚本：BFF → `:4001` `/health` → invoke | `backend/scripts/agent-linkage-smoke.js` |

### Phase 1 — writer Skill（P0）

| # | 任务 |
|---|------|
| 1.1 | `novel-writer-skill`：`index.js` + `SKILL.md` + `fill_basic` |
| 1.2 | `enum_catalog` 注入 + id 校验 |
| 1.3 | `rewrite_field` / `expand_field` / `suggest_enum` |
| 1.4 | `fill_world`（含 timeline） |
| 1.5 | `fill_characters` + edges 枚举约束 |
| 1.6 | `fill_outline`（字数按 length 区间） |
| 1.7 | `fill_chapters` + `outline_ref` |
| 1.8 | 挂到 master，`GET /api/plugins` 可见 |

### Phase 2 — 前端四组件 + 步骤接入（P0）

| # | 任务 |
|---|------|
| 2.1 | `AiSuggestDrawer` + `services/aiService.js` |
| 2.2 | `AiAssistTrigger` 挂到 `StepBasicInfo` |
| 2.3 | `AiStepAssistBar` 挂创建壳，step 1～5 |
| 2.4 | Trigger 挂世界观 / 人物卡 / 大纲 / 章节 |
| 2.5 | `NovelEditDialog` 简介、题材 |
| 2.6 | 详情 Tab「补全」跳向导 `?ai=1` |

### Phase 3 — orchestrator + PlanDock（P1）

| # | 任务 |
|---|------|
| 3.1 | `novel-orchestrator-skill` loop 三步 |
| 3.2 | `POST /api/ai/plan`、`/api/ai/dispatch` |
| 3.3 | BFF 按 `depends_on` 串行，禁止并行打乱依赖 |
| 3.4 | `AiPlanDock`：列表 AI 开书、创建页坞 |
| 3.5 | 可选表 `novel_ai_plans` |

### Phase 4 — 体验与体检（P2）

| # | 任务 |
|---|------|
| 4.1 | SSE 流式（平台已有 `status` / `delta`）进 Drawer |
| 4.2 | `novel-review-skill` 一致性 |
| 4.3 | ~~封面模型（独立出图，不塞进 writer）~~ **已做**：`POST /api/ai/cover/generate` → Agent `/api/media/generate`，侧栏 `media_profile` |
| 4.4 | 记忆：同书 session 避免人设漂移（`memoryConfig`） |

### 建议工期

| Phase | 依赖 | 建议顺序 |
|-------|------|----------|
| 0 | Agent 平台可本地起 | 最先 |
| 1.1～1.3 | Phase 0 | 先打通基础信息闭环 |
| 2.1～2.3 | 1.3 | 用户能看见第一步 AI |
| 1.4～1.7 与 2.4 | 可并行 | 按向导步骤推进 |
| 3 | 1、2 稳定 | 总任务拆分放到能单步生成之后 |
| 4 | 3 | 增强 |

### 验收（最小可用）

- [ ] 创建步 1：字段 AI 生成书名+立意，应用后保存草稿成功
- [ ] 枚举建议只出现 catalog 内选项
- [ ] Agent 关闭时有明确错误，表单仍可手填
- [ ] 前端网络面板无直连 `:4001`
- [ ] 「生成本步」不修改其他步骤 form
- [ ] PlanDock：未执行世界观时不能执行人物
- [ ] 应用 AI 后未点保存即离开，现有 dirty 确认仍有效
- [ ] `GET /api/plugins` 含两个 novel Skill

### 文档同步（开发时做，本期设计已起头）

| 文件 | 何时 |
|------|------|
| 本文 | 组件/action 变更时 |
| `docs/设计-Agent联调配置.md` | Phase 0 |
| `docs/待办-Agent开发任务清单.md` | Phase 0 从本文 §7 勾选化 |
| `docs/架构关系图.md` | 已补 Agent 节，实现后改端口/API |
| `docs/变更记录.md` | 每个落地 PR |
| `agent-management-sub/README.md` Skill 表 | Skill 合入时 |

---

## 8. 与 testgen 的对照（实现时抄什么）

| 能力 | testgen | novel |
|------|---------|-------|
| 网关 | `agentProxy.invokeSkill` | 同模式 |
| 多 Skill | judge / sample / explore 分域 | 只拆 **计划 vs 生成**，五步不拆五个 Skill |
| 引擎 hook | TS/VS `agent_hook` | 无执行引擎；hook 就是向导步骤与字段 path |
| 回写 | Skill `bffClient` + internal token | **一期不回写**；用户确认后前端走公开 REST |
| Loop | 用例四 phase | orchestrator 三 phase；writer 尽量 react 短步 |

一期不让 Skill 写 `novel_db`，避免未确认内容入库。若 P2 要自动落库，再加 internal token，对齐 testgen `X-Internal-Token`。
