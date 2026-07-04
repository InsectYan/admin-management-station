# fitness-agent · 被测项目（SUT）文档

> testgen-sub 平台对 [`fitness-agent`](../../../../../fitness-agent/) 的测试资料集：站级单测索引、缺口追踪、成熟度评分、执行命令与主表自动化字段同步。

| 元信息 | 值 |
|--------|-----|
| 被测仓库 | Pi 三端（教练 / 会员 / 店长） |
| 架构 | 六站流水线 s01→s06 |
| 文档版本 | 2026-07-03 |
| 测试成熟度 | **84/100（A-）** → [测试成熟度评分.md](./测试成熟度评分.md) |
| 权威命令说明 | [`fitness-agent/server/tests/README.md`](../../../../../fitness-agent/server/tests/README.md) |
| 测试分类体系 | [`docs/fitness-test-docs`](../../docs/fitness-test-docs/测试用例分类体系.md)（上游 [`fitness-agent-test-docs`](../../../../../fitness-agent-test-docs/测试用例分类体系.md)） |

---

## 文档导航

| 文档 | 用途 |
|------|------|
| [测试成熟度评分.md](./测试成熟度评分.md) | **P0/P1 量化评分**、分站得分、下一批建议 |
| [站级测试清单.md](./站级测试清单.md) | **已实现**的站级测试文件、filter 命令、DB 依赖 |
| [单测缺口梳理.md](./单测缺口梳理.md) | P0/P1 已覆盖 vs 仍缺项 |
| [运行命令与前置.md](./运行命令与前置.md) | 一起测 / 单一测命令速查 |
| [数据库自动化同步.md](./数据库自动化同步.md) | `test_item_detail` 自动化字段维护 |
| [测试配置JSON规则.md](./测试配置JSON规则.md) | **fitness-agent-test-json** 配置输出规则与重生成命令 |
| [fitness-agent-test-json/](./fitness-agent-test-json/) | **用例配置 JSON 快照**（413 条 `item_id`，按需导入平台） |
| [scripts/generate-test-json-configs.mjs](./scripts/generate-test-json-configs.mjs) | 从 `test_item_detail` 批量生成 `{item_id}/master.json` |
| [enriched-test-json-profiles.json](./enriched-test-json-profiles.json) | 8 条需手工丰满的矩阵/链路/辅方案 profile |

---

## fitness-agent-test-json（用例配置快照）

目录：[./fitness-agent-test-json/](./fitness-agent-test-json/)

从 `test_item_detail` 批量导出的**配置 JSON 快照**，与平台配置页上的 `config_json` 形状一致。需要快速填充边界矩阵、链路步骤或辅方案时，可直接使用该目录内容，而不必在 UI 里逐行手填。

### 目录结构

```
fitness-agent-test-json/
├── _manifest.json              # 全量索引（item_id、TS、模板、生成状态）
└── {item_id}/
    ├── master.json             # 主方案 config_json
    ├── sub.json                # 辅方案（有 scheme_secondary_id 时）
    ├── sub-obs.json            # 额外可观测检查（少数 enriched 用例）
    ├── threshold.json          # 主方案阈值
    └── threshold-sub.json      # 辅方案阈值
```

### 何时使用

| 场景 | 用法 |
|------|------|
| 配置页快速填表 | 边界矩阵等面板点 **JSON 导入**，粘贴 `master.json`（或 `sub.json`） |
| 对照 enriched 范例 | 优先看 8 条 `enriched-profile`（如 `B4-PERSIST-001` 九行 persist 矩阵 + 链路 sub） |
| 查某条用例默认配置 | 打开 `{item_id}/master.json`，对照 `_manifest.json` 中的 `scheme_primary_id` / `files` |
| 辅方案 / 阈值 | 有 `sub.json`、`threshold*.json` 时一并导入或手工粘贴 |
| 与 DB seed 对齐 | 手工种子见 `database/tables/tpl_config_*`；本目录可作为同步参考，**不是** Postgres 运行时真源 |

### 内容分层

| `_manifest.status` | 含义 |
|--------------------|------|
| `enriched-profile` | 已丰满（矩阵多行、链路 steps、辅方案等），**优先使用** |
| `automation` | 有 `automation_command`，配置以 CLI/HTTP 默认可执行为主 |
| `template-default` | 骨架占位（如 `/health` 探针），需按业务补全后再导入 |

当前 **8 条 enriched-profile**：`B4-PERSIST-001`、`B5-CONTRACT-001`、`C1-MACRO-008`、`C1-SESSION-001`、`C2-PAYLOAD-001`、`G5-UI-001`、`B6-SSE-001`、`B6-JOURNEY-001`。

### 重生成

```bash
cd admin-management-station/project-sub/testgen-sub
node test-project/fitness-agent/scripts/generate-test-json-configs.mjs
node test-project/fitness-agent/scripts/generate-test-json-configs.mjs --item B4-PERSIST-001
```

规则与 TS→JSON 形状见 [测试配置JSON规则.md](./测试配置JSON规则.md)。  
生成后维护副本位于本目录 `./fitness-agent-test-json/`；`enriched-test-json-profiles.json` 中的条目会覆盖默认模板逻辑。

---

## 覆盖率快照（2026-07-03）

| 层级 | 一起测 | 单一测示例 |
|------|--------|------------|
| 站级 s01~s06 + platform | `cd fitness-agent/server && npm run test:stations` | `npm run test:stations -- turn-submit-guard-ext` |
| 全栈 E2E | `npm run test:e2e` | `npm run test:e2e -- chain` |

**P0**：已全部落地（熔断、队列、Key、lifecycle/retry、outbox/portal 契约、SSE 帧、draft merge、queue hint）。

**P1（批次二）**：portal 幂等 replay、form gates、stream 节流、GET poll、outbox preview、Pi 降级、memory compress、member-goal-parse。

**仍待补**：wiki-knowledge compile、s06 SSE 超时。详见 [单测缺口梳理.md](./单测缺口梳理.md)。

---

## 本地环境

```bash
# 启动 fitness-agent 全栈（Postgres + Server + 前端）
fitness local

# 清运行时数据（对话/计划/队列，保留种子人物）
fitness local:clean

# 站级全量（在 fitness-agent/server）
npm install
cd ../frontend && npm install   # s01 coach-turn-session 需要 vue
cd ../server && npm run test:stations
```

---

## testgen-sub 侧维护

新增或修改 fitness-agent 单测后：

1. 更新 [站级测试清单.md](./站级测试清单.md)、[单测缺口梳理.md](./单测缺口梳理.md)、[测试成熟度评分.md](./测试成熟度评分.md)
2. 在 `scripts/sync-automation-status.mjs` 的 `PATCH` 中登记 `item_id`
3. 运行同步并注入 DB → 见 [数据库自动化同步.md](./数据库自动化同步.md)

若用例需丰满矩阵/链路/辅方案配置：

4. 更新 `enriched-test-json-profiles.json`（必要时补 `database/tables/tpl_config_*` 种子）
5. 运行 `generate-test-json-configs.mjs` 刷新 [fitness-agent-test-json/](./fitness-agent-test-json/)
