# 计划：执行期配置 AI 自动补齐（v2）

> **主题**：执行测试用例时，若用户未配齐 `config_json`，由 **BFF 编排 + 多个单职责 Agent** 补齐后执行；固定值仍缺则结构化异常。  
> **原则**：开发前置优先修复已有正确性卡点；Agent **单功能强化**（一 Agent 一事），编排在 BFF，禁止「全能 autofill」杂糅 Skill。  
> **范围**：`testgen-sub` + `agent-management-sub` + `agent-management-master`。  
> **验收锚点**：`fitness-agent-TS-01-DET-VS-01-EXACT-J1-008`（及同族 submit 用例）；另验收「新项目用例绝不误用 fitness 环境」。  
> **状态**：实施完成（代码 + 离线 smoke）· 2026-07-14 · 部署须跑 migration `038` 并重启 Agent 加载新 Skill  
> **开发 Skill（分阶段双轮执行）**：[开发SKILL.MD](../../../../开发SKILL.MD) · [execution-config-autofill/SKILL.md](../../../skills/project-developer/testgen-sub/execution-config-autofill/SKILL.md)  
> **关联**：[配置模板-缺失与卡点](./配置模板-缺失与卡点.md) · [配置模板用法](./配置模板用法/README.md) · [Skill与执行引擎关系梳理](./Skill与执行引擎关系梳理.md)

---

## 0. 一句话目标

先修「环境/变量执行正确性」→ 再挂齐全度闸门 → incomplete 时 **串行调用多个单功能 Agent**（意图 / 固定值解析 / 结构补丁 / 样本）→ 写本 run 配置 → 现有 Orchestrator 执行；固定值不可解析则阻断并返回「快照 + 缺失字段」。

---

## 1. 相对 v1 的关键变更

| 项 | v1 | v2 |
|----|----|----|
| Agent 拆分 | 1 个 `fitness-config-autofill-skill` 包办分类+解析+补丁+报告 | **4 个新单功能 Skill** + 既有 sample；BFF Pipeline 编排 |
| 扩展既有 Skill | 给 sample 加 `ensure_for_autofill`、给 config 塞意图 | **原则上不往旧 Skill 塞新职责**；sample 仅保留「生成样本」 |
| 开发前置 | Phase 0 直接 Gate | **Phase P（卡点修复）必须先完成**，尤其环境隔离 |
| 环境 bug | 未单列 | **ENV-01** 升为 P0，并回写 [缺失与卡点](./配置模板-缺失与卡点.md) |

---

## 2. 开发前置：与《配置模板-缺失与卡点》对照

> 真源：[配置模板-缺失与卡点.md](./配置模板-缺失与卡点.md)。  
> 约定：**凡本主题会改到的执行/变量/环境路径，必须先关闭对应 P0 卡点**，否则自动补齐会「补对配置、打错服务」。

### 2.1 新增 / 升格缺陷（本主题必须修）

| ID | 问题 | 根因（代码） | 严重度 | 与自动补齐关系 |
|----|------|--------------|--------|----------------|
| **ENV-01** | **新项目下新建用例，执行却打到 fitness 环境配置** | ① `ft_execution_env` **无 `project_code`**，全局一张表；② `resolveEnv` 未按项目过滤，`is_default`/首条常为 fitness seed；③ Launch/批量拉 `/api/fitness/environments` **无项目维度**；④ `loadGlobalRequestContext` / Orchestrator 默认 `project_code \|\| 'fitness-agent'` | **P0·阻塞** | Catalog、鉴权头、`bff_coach_url` 若来自错项目，Agent 会「正确补齐到错误主机」 |
| **X-03↑** | 环境入口分裂（Project 环境页 vs Fitness 环境页） | 与 ENV-01 同源；文档两套入口、执行只读 `ft_execution_env` | **P0**（原文档标中，**本主题升格**） | 用户在项目页配的 env **可能根本不进执行** |

### 2.2 既有卡点：本主题「前置必修」

| 卡点 ID | 摘要 | 前置动作 | 若不修的后果 |
|---------|------|----------|--------------|
| **CHAIN-01** | CHAIN 初始 vars **未合并** `globalRequestContext.vars` | 引擎与 DET 对齐合并 vars | 二期 CHAIN autofill 补了 `{{token}}` 仍空 |
| **API-01** | API-CTX 初始变量未显式合并项目全局 vars | runner 与 DET preflight 对齐 | 同上 |
| **DET-03** | poll 缺「执行模板主请求」/ export 校验靠运行时炸 | launch 前校验前移进 Gate | Autofill 挂上模板后仍 `UNRESOLVED_PATH_PLACEHOLDER` |
| **X-02** | `source=extract` 运行时不注入 | **本期不实现 extract 执行**；Gate/文档/异常明确「仅 manual/env/preflight」；禁止 Agent 假设 extract 可用 | 补齐写入依赖 extract 的 key → 静默失败 |

### 2.3 既有卡点：本主题「会碰到 / 可顺带，但不阻断开工」

| 卡点 ID | 关系 | 建议 |
|---------|------|------|
| **X-01** | 无变量点选；autofill 写 `{{key}}` 后用户仍难看懂 | P1：配置页变量选择器；与 autofill 展示同源 catalog |
| **DET-01/02/04** | preflight 已变更；设计稿滞后 | 用法手册 + 本计划为准；改行为时回写缺口表 |
| **SET-02** | 样本 `{{var}}` 弱于 DET | 样本 Agent 产出后由 **BFF 用同一套 applyVars** 渲染 |
| **BND-01 / REP-01** | 无 preflight | 二期 autofill；一期不承诺 |
| **PAIR-01 / OBS-01 / LOAD-*** | 对照凭证 / OBS 插值 / k6 | 不纳入本期 autofill 范围 |
| **X-04 / X-06 / X-07** | 文档陈旧 | 实现时回写；非代码阻塞 |
| **NEG-*** | 对抗 payload | 意图 Agent 可标 `omit/corrupt`；配置落地靠结构补丁 Agent，二期 |

### 2.4 本主题「不碰」的卡点（避免范围膨胀）

LOAD-01 真 k6、MAN 评审闭环、X-05 variant 专用编辑器、BND 自动生成矩阵等 — **不**作为 autofill 前置。

### 2.5 前置完成后，缺口文档应回写的状态

| ID | 目标状态文案（实现后写回《缺失与卡点》） |
|----|------------------------------------------|
| ENV-01 | 已修复：`ft_execution_env.project_code` + resolve/list 按项目；禁止默认 `fitness-agent` |
| X-03 | 已修复/降级：执行环境以用例所属项目的 `ft_execution_env` 为准；项目环境页与 Fitness 环境页语义对齐说明 |
| CHAIN-01 / API-01 | 已修复：初始 vars 合并全局 |
| DET-03 | 已修复：Gate/校验前移 |
| X-02 | 保持「未接入」但标注：Gate/Autofill **显式不依赖** extract |

---

## 3. ENV-01 修复方案（技术要点）

### 3.1 数据与 API

1. Migration：`ft_execution_env` 增加 `project_code VARCHAR(64) NOT NULL`（历史行回填 `fitness-agent`）。  
2. 索引：`(project_code, is_default)`；`is_default` **按项目唯一**（部分唯一索引或应用层保证）。  
3. `listEnvs` / `createEnv`：**强制** `project_code`（来自 query / body / 当前项目上下文）。  
4. `resolveEnv(envId, projectCode)`：  
   - 有 `envId` → `findByPk` 后校验 `row.project_code === item.project_code`，否则 `ENV_PROJECT_MISMATCH`；  
   - 无 `envId` → 仅在该 `project_code` 下找 default / 首条；  
   - **禁止**跨项目回落；该项目零环境 → `ENV_NOT_CONFIGURED`（引导去项目环境页创建）。  
5. 去掉硬编码默认：`loadGlobalRequestContext` / Orchestrator 中 `\|\| 'fitness-agent'` 改为 **必传** `item.project_code`，缺失则报错。  
6. `bff_coach_url`：继续作为执行主机字段；若要对齐项目页 `base_url`，在创建/同步时映射，避免执行仍读另一套表却用户以为已配好（X-03 产品闭环）。

### 3.2 前端

- `FitnessRunLaunchPage` / `FitnessPlanDetailPage` / `ConfigManPanel`：拉环境时带 **当前用例/计划所属 `project_code`**。  
- 环境列表空：明确「请先在本项目创建执行环境」，**不要**静默展示其它项目 env。  
- Fitness 环境页：按当前项目过滤；或迁并为项目环境的「执行端点」Tab（产品二选一，工程上先按项目过滤即可）。

### 3.3 验收

| 步骤 | 期望 |
|------|------|
| 新建项目 P2，仅配 P2 的 `bff_coach_url=http://p2` | 在 P2 用例 launch 只请求 `http://p2` |
| 列表默认/未选 env | 只落在 P2 的 default，**绝不**落到 fitness seed |
| fitness 项目用例 | 仍只用 fitness 环境，互不影响 |

---

## 4. 现状盘点（执行链路 + Agent）

### 4.1 执行链路

| 能力 | 现状 | 缺口 |
|------|------|------|
| 单条 / 批量 launch | 已通 | 无齐全度闸门、无多 Agent 补齐管线 |
| 校验失败 | 多数字符串 400 | 缺「快照 + 缺失字段」结构 |
| 配置页 AI | `fitness-config-skill` | 仅手动；**保留原职责，不改造为执行期管线** |
| pre_execute | sample 等 | **不**把多功能 autofill 塞进单一 hook 字符串 |

### 4.2 主题方案（master）

| scheme | 本主题用法 |
|--------|------------|
| **`loop`** | 结构化 JSON 单功能 Skill 默认 |
| **`langchain`** | 极短单次分类/抽取（意图 Agent 可选） |
| **`react` / `pi`** | 不用于本管线 |

### 4.3 现有业务 Skill：保持边界，不塞新职责

| Skill | 继续只做 | 本主题不做什么 |
|-------|----------|----------------|
| fitness-config-skill | 配置页按 TPL **生成草稿** | 不接 launch；不加 classify/resolve |
| fitness-sample-skill | **样本内容生成** | 不编排补齐；不判意图 |
| api-template-skill | 接口模板草案 | 只作 catalog 数据源，不调它「补配置」 |
| fitness-judge / observation / explore / perf / testgen | 原职责 | 不参与执行前补齐 |

---

## 5. 目标架构（BFF 编排 + 单职责 Agent）

```text
UI 执行 / 计划批量
        │
        ▼
┌─ Phase P 已保证 ─────────────────────────────┐
│  ENV-01 项目隔离 · CHAIN/API vars · DET-03…   │
└──────────────────────────────────────────────┘
        │
        ▼
ConfigCompletenessGate（BFF，无 LLM）
  · complete → Orchestrator
  · incomplete ↓
        │
        ▼
AutofillPipeline（BFF 确定性编排，非 Agent）
  ① fitness-intent-classify-skill      → intent + fields[]
  ② fitness-fixed-resolve-skill       → resolved_fixed + missing_fixed
        │ 若 missing_fixed 阻断 → CONFIG_AUTOFILL_BLOCKED（信封）
  ③ fitness-config-structure-skill    → config_patch（path/status/{{var}}/omit）
  ④ （可选）fitness-sample-skill      → body 样本片段 / sample_set
        │
        ▼
写 ft_run_config（config_source=agent_pipeline）→ Orchestrator.launch
```

**原则**：Agent 之间 **不互相调用**；只由 BFF Pipeline 按序 invoke；上一输出作为下一输入。

### 5.1 职责边界

| 组件 | 单一职责 | 禁止 |
|------|----------|------|
| CompletenessGate | 列 gap、对比目录可用性 | 调 LLM、写猜测值 |
| AutofillPipeline | 编排顺序、落库、组异常信封 | 内嵌 Prompt/Loop |
| intent-classify Skill | **只**输出意图与字段角色 | 不读 env 填值、不写 patch、不生成样本 |
| fixed-resolve Skill | **只**从 catalog 解析固定值 / 列出 missing_fixed | 不判测试意图、不改 path/body 结构 |
| config-structure Skill | **只**产出结构化 `config_patch` | 不查 secret、不虚构 template_id、不造长文本样本 |
| sample Skill | **只**按 schema 生成样本内容 | 不决定 omit/401 策略 |
| Orchestrator | 执行与断言 | 二次猜配置 |

---

## 6. 新建 / 沿用 Agent 清单（单功能）

### 6.1 交付总表

| # | Skill | 类型 | scheme | 单一功能 | 主要 action |
|---|-------|------|--------|----------|-------------|
| **N1** | `fitness-intent-classify-skill` | **新建** | `langchain`（单次）或短 `loop`（maxSteps=1） | 意图与字段角色识别 | `classify` |
| **N2** | `fitness-fixed-resolve-skill` | **新建** | **规则为主** + 可选短 `loop` 做模糊模板匹配 | 固定值目录解析与缺失报告 | `resolve` |
| **N3** | `fitness-config-structure-skill` | **新建** | `loop`（maxSteps=1–2） | 配置结构补丁（含故意 omit/corrupt 标记落地） | `propose_patch` |
| **N4** | `fitness-sample-skill` | **沿用**（不扩展编排职责） | 建议修正为 `loop`（scheme 声明与实现一致） | 样本内容生成 | 现有 `from_example` 等；Pipeline 只传 `schema_hint` |
| — | `fitness-config-skill` | **不动业务边界** | 可选另开任务迁 `loop` | 配置页生成 | 与 N1–N3 **无强耦合** |

> **明确不做**：`fitness-config-autofill-skill` 全能包；也不在 N2/N3 里「顺带分类」。

### 6.2 N1 · 意图分类 Agent

**输入**：item 元数据、`expected_observation`、`assertion_points`、现有 assertions/config 摘要。  
**输出**：

```json
{
  "intent": {
    "kind": "positive | omit_field_400 | unauth_401 | business_4xx",
    "expected_status": 429,
    "omit_fields": ["body.message"],
    "corrupt_headers": ["Authorization"]
  },
  "fields": [
    {
      "name": "session_id",
      "location": "body",
      "role": "variable | fixed | omit_on_purpose | corrupt_on_purpose",
      "required": true
    }
  ]
}
```

**规则优先**（LLM 只补歧义）：401 / AUTH_* → unauth_401；400 + PARAMS_REQUIRED /「缺少 x」→ omit；否则 positive/business_4xx。  
**落点**：`agent-management-sub/plugins/fitness-intent-classify-skill/`。

### 6.3 N2 · 固定值解析 Agent

**输入**：N1.fields（仅 `role=fixed` + 资源引用类）、`env_catalog`、`api_templates_catalog`、`project_vars`（键存在性，secret 不入 Prompt）。  
**输出**：

```json
{
  "resolved_fixed": [
    { "field": "headers.Authorization", "source": "env.global_headers", "present": true }
  ],
  "bindings": { "preflight_api_template_id": 12 },
  "missing_fixed": [
    {
      "field": "preflight_api_template_id",
      "expected_source": "ft_api_template",
      "detail": "当前项目无 export session_id 的模板"
    }
  ]
}
```

**硬约束**：`template_id` / env 必须 ∈ 白名单 catalog；**禁止虚构**。无 LLM 时纯规则匹配即可完成主路径。  
**对 unauth_401**：对鉴权 fixed 字段标记 `skip_resolve=true`，不得填入正确 Token。

### 6.4 N3 · 配置结构补丁 Agent

**输入**：N1 intent/fields + N2 bindings（仅 id/占位，不含 secret 明文优先）+ 当前 config_snapshot + gaps。  
**输出**：`config_patch`（`endpoint_path`、`http_method`、`http_status_expected`、`body` 中 `{{var}}` 或 omit、`assertions` 骨架、`preflight_*`、`autofill_meta`）。  
**禁止**：编造 Authorization 实体值、编造不存在的 template_id、为 omit 字段「好心补全」。  
**变量缺口**：输出 `sample_needs[]`（交给 Pipeline 决定是否调 N4），自身不生成长样本。

### 6.5 N4 · 样本 Agent（既有）

Pipeline 仅在 `sample_needs` 非空时调用；传入 N3 给出的 `schema_hint` / `sample_kind`。  
**不**新增「autofill 总控」action；若需新 action，只能是「按 schema 生成一段 body」这类仍属样本职责的细粒度接口。

### 6.6 BFF AutofillPipeline（非 Agent）

```text
async function runAutofillPipeline(ctx, { item, config, catalogs, gaps }) {
  const intent = await invoke(N1, { ... });
  const fixed  = await invoke(N2, { fields: intent.fields, catalogs, intent });
  if (fixed.missing_fixed.length) throw envelope(CONFIG_AUTOFILL_BLOCKED, ...);
  const patch  = await invoke(N3, { intent, fixed, config, gaps });
  let sampleFrag = null;
  if (patch.sample_needs?.length) {
    sampleFrag = await invoke(N4, { schema_hint: patch.sample_needs });
  }
  return merge(config, patch, sampleFrag);
}
```

异常信封仍由 BFF 组装（snapshot + intent + filled + missing_fixed），**不**再单独做「报告 Agent」。

---

## 7. 锚点用例与意图（不变，服务 N1）

`fitness-agent-TS-01-DET-VS-01-EXACT-J1-008` 同族 submit：

| 期望 | N1 | N2 | N3 |
|------|----|----|-----|
| 正向 / 业务 4xx | positive / business_4xx | 解析鉴权 + 匹配 preflight | 完整结构 + `{{session_id}}` |
| 400 缺字段 | omit_field_400 | 其余固定值仍可解析 | **不写** omit 字段 |
| 401 | unauth_401 | **跳过**鉴权 resolve | 去掉或错误化鉴权头 |

---

## 8. testgen-sub 改造点

### 8.1 Phase P 代码（前置）

| 文件 / 模块 | 改动 |
|-------------|------|
| `ft_execution_env` + model | `project_code`；seed 带项目 |
| `runOrchestrator.resolveEnv` | 项目隔离校验 |
| `fitnessExecution.listEnvs/createEnv` | 强制项目过滤 |
| `globalRequestContext.js` | 禁止默认 `fitness-agent` |
| CHAIN / API-CTX engines | 合并 `globalRequestContext.vars`（CHAIN-01、API-01） |
| DET Gate / validate | poll 必填前移（DET-03） |
| Launch / Plan 前端 | 带 `project_code` 拉环境 |

### 8.2 Gate + Pipeline + Orchestrator

- `configCompletenessGate.js`：首期 TPL-DET；gap 角色可先粗分，细角色以 N1 为准。  
- `autofillPipeline.js`：串行 N1→N2→N3→(N4)。  
- `launch`：`autofill` / `persist_autofill` 开关；默认只写 `ft_run_config`。  
- PlanBatch：逐条 Pipeline；阻断项带 missing 摘要。

### 8.3 agentProxy

为 N1/N2/N3 各增 `invokeFitnessIntentClassify` / `invokeFitnessFixedResolve` / `invokeFitnessConfigStructure`（或统一 `invokeSkill(name, …)` 三处调用）。  
**不**恢复「单个 autofillInvokePath 打全能 Skill」。

### 8.4 异常信封（必须字段）

与 v1 相同核心字段，并增加：

- `project_code` / `env_id` / `env_name`（便于发现 ENV 串项目）  
- `pipeline_step`：失败停在 classify | resolve | structure | sample  

### 8.5 配置模板文档 / Schema

| 文档 / 代码 | 调整 |
|-------------|------|
| `00-通用约定.md` | 执行环境 **按项目**；禁止默认 fitness；自动补齐管线与开关 |
| `TPL-DET.md` | 对齐 N1–N3 字段表；401/400 禁忌 |
| `配置模板-缺失与卡点.md` | 登记 ENV-01；完成后改状态 |
| `detAssertions.js` | 文案 status 写入 rules（利 N1） |
| `config_source` | `agent_pipeline`（或分步审计） |

### 8.6 Catalog 组装（BFF → N2）

必须带 **当前 `item.project_code`** 过滤后的：

- `env_catalog`（键存在性）  
- `project_vars`（manual 有值）  
- `api_templates_catalog`（本项目模板）

---

## 9. 分阶段实施

### Phase P — 正确性前置（**先做，约 2–3 天**）

- [x] **ENV-01**：`project_code`、resolve/list、去硬编码 default、前端按项目选环境（须部署跑 `038_*.sql`）
- [x] **CHAIN-01 / API-01**：vars 合并对齐 DET
- [x] **DET-03**：poll / export 校验前移（`detLaunchGuard`）
- [x] **X-02**：Gate/错误/环境页与手册提示「extract 不生效」
- [x] 回写《缺失与卡点》状态（ENV-01 标注部署 migration）
- [x] 离线验收：`npm run smoke:phase-p`（项目隔离挑选 + DET-03）；运行时验收：部署 migration 后新项目用例主机 = 该项目 env

### Phase 0 — Gate + 信封（0.5–1 天）

- [x] `configCompletenessGate`（DET；仅 fixed 缺口阻断）
- [x] `CONFIG_AUTOFILL_BLOCKED` 信封（含 project/env/snapshot/missing_fixed；Phase 0 尚无 Agent）
- [x] launch 开关 `autofill`（默认 true；false 可跳过 Gate）
- [x] `npm run smoke:phase-0`；Launch 页展示 missing_fixed 摘要
- [x] 控制器 `handleError` 透传 `err.data`

### Phase 1 — 单职责 Agent（约 3–4 天）

- [x] N1 intent-classify（规则 + loop；`smoke:phase-1-agents`）
- [x] N2 fixed-resolve（规则主路径 + 三检；结构元数据 defer）
- [x] N3 config-structure（规则 + 401/400 三检）
- [x] agentProxy ×3 + master plugins junction 挂载

### Phase 2 — Pipeline 嵌入（1–2 天）

- [x] `autofillPipeline` 串行编排（Agent 优先，规则降级）
- [x] 写 `ft_run_config.config_json` + `autofill_meta`
- [x] launch 集成；PlanBatch 经 launch 同源
- [x] Launch 页 missing 展示；`smoke:phase-2-pipeline`

### Phase 3 — 样本衔接 + 锚点验收（1–2 天）

- [x] Pipeline 按需调 N4 sample（失败不阻断）
- [x] J1-008 族离线：空配置 / 401 / 400 omit / 无模板 missing
- [x] ENV-01 回归：信封含 `project_code`，不落 fitness-agent
- [x] smoke：phase-1-agents / phase-2-pipeline / n2

### Phase 4 — 文档与二期模板

- [x] 用法手册要点 / 计划勾选 / Skill 索引与联调路径
- [ ] 二期：SET/BND/NEG Gate（不阻塞本期关闭）


---

## 10. 验收标准

### 10.1 前置（无自动补齐也必须过）

1. 新项目 + 新用例执行 **只**使用该项目 `ft_execution_env`。  
2. CHAIN/API-CTX 能使用项目 manual 全局变量插值（与 DET 一致）。  
3. DET poll 缺前置条件时 launch 前失败信息可读。

### 10.2 自动补齐

1. 未配齐 DET：补齐后可跑，或信封点明 `missing_fixed`。  
2. 401/400 意图不被结构补丁「傻补全」破坏。  
3. 无匹配模板时点名 `preflight_api_template_id`（或等价），且 **id 不出现幻想值**。  
4. 每个 Skill 可单独 invoke 单测；Pipeline 失败能指出 `pipeline_step`。  
5. 审计可区分 N1/N2/N3/N4 各自 I/O。

### 10.3 锚点表

| 场景 | 期望 |
|------|------|
| 空 config 正向/业务 4xx | N3 补结构；N2 绑 env/模板；样本按需 |
| 环境无鉴权 | N2 `missing_fixed` |
| 无 bootstrap 模板 | N2 `missing_fixed` |
| 断言 401 | N2 不填正确 Token；N3 去鉴权 |
| 断言 400 缺字段 | N3 不写入该字段 |
| 新项目 P2 | 全程 env/catalog 仅 P2 |

---

## 11. 风险与对策

| 风险 | 对策 |
|------|------|
| Agent 再度杂糅 | Code review：新 Skill 禁止新增与声明无关的 action；编排只在 BFF |
| 多跳延迟 | N2 规则短路；齐全则跳过 Pipeline；catalog 按项目缓存 |
| LLM 幻觉 template_id | N2 白名单校验为唯一写入 bindings 的关口 |
| 未修 ENV-01 就上 Agent | Phase 门禁：ENV 验收不过不进入 Phase 1 |
| extract 被当成可用 | N2/Gate 黑名单 source=extract |
| 与配置页 AI 冲突 | config-skill 不动；pipeline `config_source=agent_pipeline` |

---

## 12. 工作量粗估

| 模块 | 人天 | 仓 |
|------|------|-----|
| Phase P（ENV + vars + DET-03） | 2–3 | testgen-sub |
| Gate + 信封 + Pipeline + Orchestrator | 2–3 | testgen-sub |
| N1 + N2 + N3 | 3–4 | agent-management-sub |
| 前端项目环境 / missing UI | 1–1.5 | testgen-sub |
| 文档 / 联调 / 双验收 | 1–2 | 双仓 |
| **合计** | **约 9–14** | |

相对 v1 略增：换来环境正确性与可维护的单职责边界。

---

## 13. 文档回写清单

| 文档 | 动作 |
|------|------|
| 本文 | 进度与版本 |
| [配置模板-缺失与卡点.md](./配置模板-缺失与卡点.md) | 增加 ENV-01；X-03 升格说明；完成后改状态 |
| `00-通用约定.md` / `TPL-DET.md` | 项目环境 + 补齐管线 |
| `Skill与执行引擎关系梳理.md` | N1–N3；删「全能 autofill」设想 |
| `设计-Agent联调配置.md` / 待办清单 / 节点追踪 | 登记三 Skill + ENV |
| `agent-management-sub/README.md` | 三行新 Skill |

---

## 14. 建议开工顺序

1. **Phase P / ENV-01**（立刻可修，不依赖 LLM）。  
2. CHAIN-01、API-01、DET-03。  
3. Gate + 纯 BFF 缺失信封。  
4. N2（规则）→ N1 → N3 → Pipeline 串起来。  
5. 按需接 sample；J1-008 + 新项目双验收。

---

## 附录 A · 路径速查

| 用途 | 路径 |
|------|------|
| 环境表 | `database/migrations/003_fitness_runtime.sql` → `ft_execution_env` |
| resolveEnv | `backend/app/service/execution/runOrchestrator.js` |
| 全局上下文 | `backend/app/lib/globalRequestContext.js` |
| 环境 API | `fitnessExecution.listEnvs` · `FitnessEnvironmentsPage.vue` |
| 缺口真源 | `docs/配置模板-缺失与卡点.md` |

## 附录 B · Skill 职责一览（防回归杂糅）

```text
N1 intent-classify     → 只回答「测什么、字段什么角色」
N2 fixed-resolve       → 只回答「固定值从哪来 / 缺什么」
N3 config-structure    → 只回答「config_json 应长什么样」
N4 sample（既有）      → 只回答「样本内容是什么」
BFF AutofillPipeline   → 只负责顺序、落库、信封
fitness-config-skill   → 只负责配置页生成（不进 launch）
```

---

*确认 v2 后按 §9 Phase P 开工；未完成 ENV-01 不得进入 Agent 开发。*
