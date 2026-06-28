# Fitness 测试体系 — 待开发节点

> 更新：2026-06-28  
> 范围：testgen-sub Fitness 模块（不含 Agent、不含已有 scope/suite 页面）

---

## 一、执行引擎（全部未实现）

接口已挂载，调用返回 `501 ENGINE_NOT_IMPLEMENTED`。

| 方案 ID | 引擎能力 | API | 前端配置页 |
|---------|----------|-----|------------|
| TS-01-DET | HTTP/CLI 断言代理 | `POST /api/fitness/engines/TS-01-DET/execute` | `/fitness/execution/run/:id/config/det` |
| TS-02-BND | 矩阵循环断言 | 同上 pattern | `config/bnd` |
| TS-03-REP | Agent × N + Pass^k | 同上 | `config/rep` |
| TS-04-SET | 样本集批量 + 达标率统计 | 同上 | `config/set` |
| TS-05-CHAIN | 轻量编排 + 变量池 | 同上 | `config/chain` |
| TS-06-PAIR | 跨端并行 diff | 同上 | `config/pair` |
| TS-07-NEG | 对抗集 + 阻断率 | 同上 | `config/neg` |
| TS-08-OBS | SLS/RDS/OTel 查询 | 同上 | `config/obs` |
| TS-09-LOAD | k6/locust 压测 Job | 同上 | `config/load` |
| TS-10-MAN | 评审工作流 | 同上 | `config/man` |

### 执行链路缺失

- [ ] `POST /api/fitness/run/:itemId/launch` 创建 run 后的异步 Job 调度
- [ ] WebSocket/SSE 进度推送至 `/fitness/execution/runs/:runId`
- [ ] VS 判定引擎（RATE/PASSK/BLOCK/SLO/MAJORITY）
- [ ] LLM Judge（TS-03/04/07 可选）
- [ ] `POST /api/fitness/environments/health-check` 环境探活代理
- [ ] dry-run 单条（launch 页）
- [ ] 重跑失败项、导出 JSON 日志（控制台）

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

## 五、与已有模块边界

| 模块 | 状态 |
|------|------|
| Agent 生成链路 (`/scope`, `/jobs`) | **未改动** |
| 旧测试用例管理 (`/suite`, `test_cases`) | **未改动** |
| 旧执行监控 (`/runs/:runId`) | **未改动** |
| Fitness 执行 (`ft_run`, `/fitness/execution/*`) | 新体系，与 test_runs 独立 |

---

## 六、建议开发顺序（参考文档 §八）

1. E0 环境 + 控制台壳层 ✅（UI 壳层完成，引擎 ❌）
2. E1 TS-01 DET 引擎
3. E2 TS-04 SET + 样本集 + 达标率
4. E3 TS-02 BND 矩阵
5. E4 TS-05 CHAIN
6. E5 其余方案 + 计划批量执行队列
