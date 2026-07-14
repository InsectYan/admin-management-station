---
name: execution-config-autofill-dev
description: >-
  按「执行期配置 AI 自动补齐」计划分阶段双轮开发、功能检测与代码 CR。
  用于实现 ENV-01、CompletenessGate、AutofillPipeline 与单职责 Agent（intent/fixed-resolve/config-structure）。
  当用户引用计划-执行期配置AI自动补齐.md、开发SKILL.MD，或要求开发执行期配置自动补齐时使用。
---

# 执行期配置 AI 自动补齐 — 开发 Skill

> **计划真源**（只按此文档阶段推进，禁止跳阶段）：  
> [`project-sub/testgen-sub/docs/计划-执行期配置AI自动补齐.md`](../../../../project-sub/testgen-sub/docs/计划-执行期配置AI自动补齐.md)  
> **卡点对照**：[`配置模板-缺失与卡点.md`](../../../../project-sub/testgen-sub/docs/配置模板-缺失与卡点.md)  
> **通用 testgen 流程**：先读 [`../SKILL.md`](../SKILL.md) / [`../../../sub-app-developer/SKILL.md`](../../../sub-app-developer/SKILL.md)

---

## 重点与目标导向（开场必读，每阶段第二轮前再读一遍）

| 导向 | 含义 |
|------|------|
| **正确性优先** | 未完成计划 **Phase P（尤其 ENV-01）** 不得进入 Agent / Pipeline 开发 |
| **单 Agent 单职责** | N1 意图 / N2 固定值解析 / N3 结构补丁 / N4 样本；编排只在 BFF；禁止全能 autofill Skill |
| **按项目隔离环境** | 新项目用例绝不能落到 `fitness-agent` 环境或硬编码 `project_code \|\| 'fitness-agent'` |
| **固定值不可臆造** | 无匹配 env/模板 → 结构化 `missing_fixed`；禁止虚构 `template_id` / Token |
| **意图保真** | 401 不回填正确鉴权；400 故意缺字段不得「好心补全」 |
| **一阶段一交付** | 严格按计划 §9：`P → 0 → 1 → 2 → 3 → 4`；当前阶段两轮完成前不开下一阶段 |

会话开始时：打开计划文档，用简短列表复述**当前阶段目标**与上表导向，再开干。

---

## 强制工作流（每个阶段必须跑满两轮）

```text
对计划中每一个 Phase（P / 0 / 1 / 2 / 3 / 4）：

  ┌─ 第 1 轮：按计划文档执行 ─────────────────────────────┐
  │  1. 仅实现本阶段清单项（不提前做下一阶段）              │
  │  2. 功能检测（见下方「功能检测」）                        │
  │  3. 代码 CR（见下方「代码 CR」）                          │
  │  4. 修到检测 + CR 通过                                   │
  └────────────────────────────────────────────────────────┘
                          ▼
  ┌─ 阶段间复核（进入第 2 轮前）────────────────────────────┐
  │  再读一遍本 Skill「重点与目标导向」+ 计划中本阶段目标    │
  │  审查本阶段是否有缺漏：                                 │
  │    · 有缺漏 / 计划需补丁 → 先改计划文档相关小节，再第 2 轮│
  │    · 计划无需改 → 第 2 轮按「本阶段目标」做查缺补漏开发 │
  └────────────────────────────────────────────────────────┘
                          ▼
  ┌─ 第 2 轮：查缺补漏为主 ───────────────────────────────┐
  │  1. 对照导向与验收表补洞、加固边界/单测/文案             │
  │  2. 再跑一遍功能检测 + 代码 CR                           │
  │  3. 两轮均通过 → 勾选计划文档本阶段清单 → 才进下一阶段   │
  └────────────────────────────────────────────────────────┘
```

**硬规则**：同一阶段必须执行两次完整「开发 → 检测 → CR」；第 2 轮以查缺补漏为主，不是简单重做第 1 轮全部代码。

---

## 阶段映射（与计划 §9 一致）

| Phase | 目标摘要 | 第 2 轮重点查缺 |
|-------|----------|-----------------|
| **P** | ENV-01 项目环境隔离；CHAIN-01/API-01 vars；DET-03；X-02 提示 | 新项目 launch 主机/鉴权不串 fitness；去掉一切默认 `fitness-agent` |
| **0** | CompletenessGate + 异常信封 + launch 开关 | 信封含 `config_snapshot` / `project_code` / `env_*`；无 LLM 也可列 gap |
| **1** | 新建 N1/N2/N3 单职责 Skill + agentProxy | 一 Skill 一事；scheme 与 `config.loop` 一致；输出 JSON schema 稳定 |
| **2** | AutofillPipeline 串行嵌入 Orchestrator/PlanBatch | Agent 互不调用；失败带 `pipeline_step`；默认只写 `ft_run_config` |
| **3** | 按需调 N4；J1-008 族 + ENV 回归 + smoke | 401/400 意图不被破坏；无模板时 missing 点名正确字段 |
| **4** | 用法/缺口/联调文档回写 | 计划与《缺失与卡点》状态一致；不扩 LOAD/MAN 等未承诺范围 |

未完成 Phase P 验收（计划 §10.1）→ **停止**，不得开始 Phase 0 以后的 Agent 工作。

---

## 功能检测（每轮必做）

按当前阶段选做，全部写清「命令 / 操作步骤 / 实际结果」：

1. **静态**：相关单测或 `npm run smoke:*`（如 `smoke:e6`、`smoke:agent-linkage`）；改 env 解析则加「新项目 ≠ fitness」断言或手工路径。  
2. **运行时**：启动所需服务后，用真实/夹具路径验证本阶段验收项（计划 §10）。  
3. **回归**：ENV-01 相关改动后，无论哪一阶段，至少抽测「项目 A 用例不打项目 B / fitness 环境」。  
4. **失败可读**：期望阻断时，响应含缺失字段清单与配置快照（Phase 0+）。

不通过 → 先修再结束本轮，禁止带红进入 CR「口头通过」。

---

## 代码 CR（每轮必做）

自审并列出结论（通过 / 打回）：

- [ ] 范围仅限本阶段；无无关重构  
- [ ] 无硬编码跨项目默认环境  
- [ ] Agent/BFF 边界：BFF 无内嵌 LLM Loop；Skill 无落业务 DB（经约定 API/返回 patch）  
- [ ] 单职责：未往旧 Skill 塞编排/多功能 action  
- [ ] Secret：Prompt/日志不轻易打 Token 全文（优先键存在性）  
- [ ] 文档：本阶段要求回写的缺口/用法/联调是否已改  
- [ ] 与 [agent-skill-development.mdc](../../../../.cursor/rules/agent-skill-development.mdc) 落点一致（新 Skill → `agent-management-sub/plugins/`）

---

## Agent 双轮 + 模板字段三检（Phase 1 起，每生成一个 Agent）

每新建/大改一个 Agent（N1/N2/N3，及对 N4 的衔接），单独跑与阶段相同的 **两轮**，并在两轮内对「固定格式输出」做 **三次** 校验。

### Agent 两轮

| 轮次 | 做什么 |
|------|--------|
| Agent-R1 | 按计划 §6 实现：`index.js` / `SKILL.md` / `templates/*` / `lib/*`；单 action 职责；功能检测（单独 invoke）+ CR |
| 复核导向 | 对照「单职责 / 不臆造固定值 / 意图保真 / JSON 契约」；缺则改计划§6 小节或 Prompt |
| Agent-R2 | 查缺：提示词、jsonSchemaHint、ruleFallback、越权字段；再检测 + CR |

### 模板字段输出 — 循环检测三次

凡 Agent 会产出 **须符合测试用例 / 配置模板入参形状** 的字段（尤其 **N3 `config_patch`**、N4 样本片段、与 TPL-DET / `templateOutputFormats` 对齐的结构），必须连续 **3 次** 检测：

| 次 | 焦点 |
|----|------|
| **第 1 次** | 输出 JSON 能解析；必填键齐全（如 DET：`endpoint_path`/`http_method`/`http_status_expected`/`body`/`headers`/`assertions` 等按意图） |
| **第 2 次** | 与目标模板约定对比：类型、占位 `{{var}}`、omit/corrupt 是否误填；`preflight_api_template_id` ∈ catalog |
| **第 3 次** | 锚点场景（J1-008 族：正向 / 400 omit / 401）：三次用例或三次独立 invoke，确认未回退、未串意图 |

任一次失败 → 改 Prompt/规则/schema → **从第 1 次起重新计三次**（不要只补一次就放行）。

提示词优化清单（R2 必问）：

- 是否泄漏成「补全一切」而破坏 401/400？  
- 是否要求输出计划外的杂糅字段？  
- `jsonSchemaHint` 是否与 BFF Pipeline 消费字段一致？  
- no_llm 时 ruleFallback 是否仍满足「不臆造固定值」？

---

## 进度输出模板（每轮结束时贴给用户）

```markdown
### Phase <P|0|1|2|3|4> · 第 <1|2> 轮

**本轮目标**：（一句）
**导向复核**：已对照 Skill 重点表 / 有无计划修订：（无 | 已改 xxx）

**已完成**
- …

**功能检测**
- 命令/步骤：
- 结果：通过 | 失败（…）

**代码 CR**
- 结论：通过 | 打回
- 问题与修复：…

**Agent 专项**（若本阶段有）
- Agent：N?
- 提示词是否调整：
- 模板字段三检：第1 □ 第2 □ 第3 □

**是否可进入下一阶段**：是（两轮完成）| 否（原因）
```

---

## 禁止事项

- 跳过 Phase P 或跳过任一阶段的第 2 轮  
- 合并多个 Agent 职责到一个 Skill  
- 在 testgen-sub BFF 内嵌完整 LLM Agent 循环  
- 虚构 env / template_id / 鉴权秘密来「凑可执行」  
- 计划未勾选完成就声称阶段结束  

---

## 相关路径速查

| 项 | 路径 |
|----|------|
| 计划 | `testgen-sub/docs/计划-执行期配置AI自动补齐.md` |
| 执行编排 | `testgen-sub/backend/app/service/execution/runOrchestrator.js` |
| 全局上下文 | `testgen-sub/backend/app/lib/globalRequestContext.js` |
| Agent 插件 | `agent-management-sub/plugins/` |
| 方案文档 | `agent-management-master/docs/schemes/` |
