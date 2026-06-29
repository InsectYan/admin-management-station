# Fitness 测试体系 — 待开发节点

> 更新：2026-06-28  
> 范围：testgen-sub Fitness 模块（不含 Agent 生成链路 `/scope`、`/jobs`；不含旧 `/suite`）  
> **详细技术方案**：[FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md)（执行引擎 / Runner / Agent 分离 / 前后端目录 / API 契约）

---

## 一、执行引擎（E1 部分已实现）

| 方案 ID | 引擎能力 | 状态 |
|---------|----------|------|
| TS-01-DET | HTTP/CLI 断言 | **E1 ✅** |
| TS-02-BND | 矩阵循环断言 | ❌ E3+ |
| TS-03-REP | 重复 + Pass^k | ❌ E3 |
| TS-04-SET | 样本集 + 达标率 | ❌ E2 |
| TS-05-CHAIN | 轻量编排 | ❌ E4/E5 |
| TS-06～10 | 其余 | ❌ |

### 执行链路

- [x] `POST /api/fitness/run/:itemId/launch` 异步 Job（runInBackground）
- [x] SSE `/api/fitness/runs/:runId/stream`
- [x] VS-02-CONTRACT（CLI exit / HTTP 断言）
- [x] `POST /api/fitness/environments/health-check`
- [ ] dry-run 单条（launch 页）
- [ ] 重跑失败项、导出 JSON 日志（控制台）
- [ ] LLM Judge（E6）

---

## 二、前端交互缺失

### P0 管理页

- [x] 测试项库：批量加入计划、导出 CSV/JSON、复制 automation_command、筛选区一键清空
- [x] 测试项详情：关联项点击跳转图谱、风险 GUARD/DETECT 徽章色
- [ ] 计划向导：步骤 5 发版准则说明、PDF/Markdown 计划导出
- [ ] 完成报告：按 TS/VS/维度/PRD 聚合通过率、阈值对比图表

### P1 洞察页

- [ ] 指标中心：条形图/饼图/热力矩阵（当前为表格）
- [ ] 分析中心：P0 待建跳转 config 引导
- [ ] 风险中心：力导向关联图、反向查询输入框

### P2

- [ ] 架构专题页 `/topics/stations|business|observability`
- [ ] 六站×三端热力图可视化

### 执行层

- [ ] 样本集：单条 CRUD、CSV/JSON 导入、从 test_input_example 生成
- [ ] 配置页：阈值子面板（validation → threshold_param_enum 动态表单）
- [ ] 配置页：辅助方案折叠区（scheme_secondary_id）
- [ ] 执行中心：进行中 Tab 实时进度、取消队列
- [ ] 控制台：通过率曲线、阈值卡、写入计划报告

---

## 三、数据库与数据

- [x] 23 表 + 12 视图 DDL → `database/tables/`
- [x] 启动 schema 同步（DDL only，不含 INSERT）
- [x] `npm run db:seed` 全量/单表注入（需 init.sql + data.json）
- [ ] 视图 data.json 不参与 seed（仅表数据）；视图由 SQL 实时计算
- [ ] 文档更新后重新 copy tables 并 seed 的操作说明写入 README

---

## 四、后端待增强

- [ ] 测试项在线编辑（文档明确首版不做，保持只读）
- [ ] ft_sample_item CRUD API
- [x] 计划删除 API
- [ ] 枚举表分组展示 config_env domain
- [x] 导出 test_item_detail CSV

---

## 五、模块边界与跨仓变更

> 原则：**为测试服务，全链路均可改**；跨 testgen-sub 的改动须登记 [FITNESS_EXECUTION_TECH.md §1.5](./FITNESS_EXECUTION_TECH.md#15-跨仓库--跨模块变更清单变更内容--计划) 变更 ID。

| 模块 | 默认策略 | 变更 ID（若测试仍不满足） |
|------|----------|---------------------------|
| Agent 生成链路 (`/scope`, `/jobs`) | 本迭代不改 | — |
| 旧 suite / `test_runs` | 与 `ft_run` 并行 | CH-TG-01 |
| fitness-agent SUT | 首版只消费 API | CH-SUT-01～03 |
| fitness-agent-test-docs | 不改 testgen 内编辑 | CH-DOC-01 |
| agent 平台 Skill | 新增 judge，不改 testgen-skill | CH-AG-01 |
| Fitness 执行 (`ft_run`) | **本方案重心** | CH-INFRA-02/03 |

---

## 六、建议开发顺序（参考文档 §9）

1. E0 环境 + 控制台壳层 ✅
2. **E1 TS-01 DET + Orchestrator + SSE ✅**（需 `FITNESS_AGENT_ROOT`）
3. E2 TS-04 SET + 样本集 + 达标率
4. E3 TS-02 BND 矩阵
5. E4 TS-05 CHAIN
6. E5 其余方案 + 计划批量执行队列
