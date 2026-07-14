# 配置模板用法手册

> 用途：说明测试平台 **每一个配置模板（TPL-*）** 在用例配置页应如何填写，以及如何引用前置接口抛出的字段、项目全局环境变量。  
> 范围：`testgen-sub` · 对齐前端 `Config*Panel` / `Tpl*Panel` 与执行引擎实现。  
> 更新：2026-07-14

---

## 文档组索引

| 文档 | 说明 |
|------|------|
| [00-通用约定.md](./00-通用约定.md) | 环境变量、`{{key}}` 插值、接口模板、DET vs API-CTX 选型 |
| [TPL-DET.md](./TPL-DET.md) | 确定性单次（前置关联 + 主请求） |
| [TPL-BND.md](./TPL-BND.md) | 边界矩阵 |
| [TPL-REP.md](./TPL-REP.md) | 重复抽样 |
| [TPL-SET.md](./TPL-SET.md) | 固定样本集 |
| [TPL-CHAIN.md](./TPL-CHAIN.md) | 多步链路 |
| [TPL-API-CTX.md](./TPL-API-CTX.md) | 前置链路 + 接口模板（完整上下文） |
| [TPL-PAIR.md](./TPL-PAIR.md) | 对照对比 |
| [TPL-NEG.md](./TPL-NEG.md) | 对抗专项 |
| [TPL-OBS.md](./TPL-OBS.md) | 可观测稽核 |
| [TPL-LOAD.md](./TPL-LOAD.md) | 压测容量 |
| [TPL-MAN.md](./TPL-MAN.md) | 人工评审 |

**缺口汇总（跨模板）**：[../配置模板-缺失与卡点.md](../配置模板-缺失与卡点.md)

---

## 模板一览

| 模板 | 中文名 | TS | 配置页 Panel | 典型场景 |
|------|--------|-----|--------------|----------|
| TPL-DET | 确定性单次 | TS-01-DET | `ConfigDetPanel` | 单次 HTTP / CLI，可选前置取参 |
| TPL-BND | 边界矩阵 | TS-02-BND | `ConfigBndPanel` | 多行 path/command 矩阵 |
| TPL-REP | 重复抽样 | TS-03-REP | `ConfigRepPanel` | Pass@k / 多次同请求 |
| TPL-SET | 固定样本集 | TS-04-SET | `ConfigSetPanel` | Golden 样本集通过率 |
| TPL-CHAIN | 多步链路 | TS-05-CHAIN | `ConfigChainPanel` | 手写 steps + extract |
| TPL-API-CTX | 前置链路+接口模板 | TS-05-API | `ConfigApiCtxPanel` | 复用接口模板完整流程 |
| TPL-PAIR | 对照对比 | TS-06-PAIR | `ConfigPairPanel` | 多角色 path 对照 |
| TPL-NEG | 对抗专项 | TS-07-NEG | `ConfigNegPanel` | 拦截率 / 安全对抗 |
| TPL-OBS | 可观测稽核 | TS-08-OBS | `ConfigObsPanel` | journey / 字段存在性 |
| TPL-LOAD | 压测容量 | TS-09-LOAD | `ConfigLoadPanel` | VU × 时长 + SLO |
| TPL-MAN | 人工评审 | TS-10-MAN | `ConfigManPanel` | 量表打分 |

入口路径（用例配置）：

```text
/fitness/items/:itemId/config/{det|bnd|rep|set|chain|api-ctx|pair|neg|obs|load|man}
```

混合大类（C1–C4）可在用例详情切换 `TPL-CHAIN` ↔ `TPL-API-CTX`。

---

## 阅读顺序建议

1. 先读 [00-通用约定.md](./00-通用约定.md)（变量从哪来、怎么写）
2. 按用例 `scheme_primary_id` / `template_code` 打开对应 TPL 文档
3. 配置卡顿或疑似缺陷时查 [配置模板-缺失与卡点.md](../配置模板-缺失与卡点.md)

---

## 相关设计文档

| 文档 | 关系 |
|------|------|
| [设计-配置模板与52大类.md](../设计-配置模板与52大类.md) | 大类 → 模板归并（设计稿，字段可能滞后） |
| [设计-接口模板与样本集.md](../设计-接口模板与样本集.md) | 接口模板 `ft_api_template` 结构 |
| [Skill与执行引擎关系梳理.md](../Skill与执行引擎关系梳理.md) | TPL ↔ TS ↔ 引擎 ↔ Skill |
| [测试平台架构关系图.md](../测试平台架构关系图.md) | 分层与路由 |
