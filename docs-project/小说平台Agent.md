# 小说平台 Agent 产品说明

> **状态**：设定向导、单章开发、P0 正文入口与 P1 续写/进度/全书预览导出已落地。P1-5 连续执行设定、P2 体检与版本见 [开发计划.md](./开发计划.md)  
> **详细设计 / 组件**：[`project-sub/novel-sub/docs/Agent设计/readme.md`](../project-sub/novel-sub/docs/Agent设计/readme.md)  
> **下一阶段开发方案（自动成书）**：[开发计划.md](./开发计划.md)  
> **规范依据**：[`agent-management-master`](../../agent-management-master/README.md) · AMS [`agent-skill-development.mdc`](../.cursor/rules/agent-skill-development.mdc)

本文件是小说创作平台的 **Agent 产品入口**。页面与表单已落地（列表 / 五步创建 / 详情），智能能力按「**总任务拆分 + 领域生成**」接入，不在 `novel-sub` 内嵌 LLM。

---

## 1. 要解决什么

创作者在五步向导里要填大量结构化字段（立意、世界观、人物、大纲、章节）。Agent 的目标是：

1. **一句话开书**：把「东方玄幻 / 系统流 / 男频长篇」拆成对齐现有表单的子任务，逐步回填。
2. **当前步骤辅助**：只生成本步字段，不越权改其他步骤。
3. **单字段润色**：对已有文本做生成 / 扩写 / 改写，用户确认后再写入。
4. **设定体检**（二期）：详情页检查人物/世界观/大纲是否自洽。

人工始终可改；Agent 只出建议，**默认不自动落库**。

---

## 2. 两层「编排」不要混

| 层级 | 谁 | 做什么 |
|------|----|--------|
| **平台编排** | `agent-management-master` 主 Agent | HTTP → 选 scheme → 跑 Executor → Skill callbacks。**不懂小说业务。** |
| **业务拆分** | `novel-orchestrator-skill` | 把「写一本小说」拆成五步子任务（plan），标依赖与缺口。 |
| **领域生成** | `novel-writer-skill` | 按 action 产出对齐 `novelCreateSchema` 的 JSON。 |
| **业务网关** | `novel-sub` BFF `agentProxy` | 前端唯一入口；按 plan **串行**调用 writer；审计；可选落库。 |
| **交互** | 4 个 Vue 组件 | 字段按钮 / 建议抽屉 / 步骤条 / 计划坞。禁止直连 `:4001`。 |

主 Agent 的「统一流水线」不是小说总任务拆分。总任务拆分是 **独立 Skill**，由 BFF 按 plan 调度 writer，避免 Skill 套 Skill 超时。

---

## 3. 页面入口（产品）

| 页面 | 入口 | 走哪条链路 |
|------|------|------------|
| 列表 | 「AI 开书」 | orchestrator `plan` → 建草稿 → 进入向导 + 计划坞 |
| 列表 | 「去写正文」 | 详情单章开发 `?tab=7`（需已有章节目录） |
| 创建向导末步 | 「开始写正文」 | 详情单章开发第一章 |
| 详情单章 | 「写下一空章」 | writer `fill_chapter_body` → 确认 → PUT 空章 |
| 详情 / 列表 | 「续写未完成章节」 | 前端串行空章队列；每章独立 turns + PUT |
| 详情 | 「全书预览」tab=8 | `GET /reader` Markdown；导出 TXT / MD |
| 开书计划 | 「执行下一步」`plan.bodies` | dispatch 第一个空章，打开详情 tab=7 |
| 创建五步 | 步骤条旁「生成本步」+ 字段旁「AI」 | writer 对应 action；或 plan 中的当前 task |
| 列表编辑弹窗 | 简介 / 题材「AI」 | writer `fill_basic` / `rewrite_field` |
| 详情 | 「补全设定」「设定体检」 | orchestrator 补缺口；review 为 P2 |

---

## 4. Skill 落点

| 项 | 约定 |
|----|------|
| 插件源码 | `agent-management-sub/plugins/`（默认；运行时挂到 master） |
| 方案 | orchestrator → `loop`；writer → `react`（短步）或 `loop`（多角色/多卷） |
| 调用 | `POST /api/skills/:name/invoke`，body 含 `action` |
| 前端 | 只调 `novel-sub` `/api/ai/*` |

完整组件契约、字段映射、功能向导与 Phase 计划见子应用设计文档。
