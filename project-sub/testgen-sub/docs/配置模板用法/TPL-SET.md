# TPL-SET — 固定样本集

| 项 | 值 |
|----|-----|
| template_code | `TPL-SET` |
| scheme | `TS-04-SET` |
| Panel | `ConfigSetPanel.vue` |
| 引擎 | `ts04SetEngine.js` |
| 典型 VS | VS-07-RATE-* |

用于 Golden / Eval 样本集（E1、E6、E_SKILL、A6 等）。

---

## 配置项

| 字段 | 说明 |
|------|------|
| `sample_set_id` | 关联 `ft_sample_set` |

阈值：

| 字段 | 说明 |
|------|------|
| `rate_L` / `rate_M` / `rate_H` | 通过率档位阈值 |

样本集本体（input/expected）在「样本集管理」维护，不在本 Panel 逐条编辑。

---

## 全局环境与前置

- 执行仍走所选环境的主机与 `global_headers`
- 样本行内若含 `{{key}}`，能否插值取决于引擎对样本渲染的实现（**当前以样本落库原文字段为主**；关键鉴权仍靠环境头）
- **不**在 SET 页关联接口模板；需上下文时先在数据准备阶段把会话 ID 写进样本 `input_data`

---

## 配置举例

```json
{
  "sample_set_id": 5
}
```

```json
{
  "rate_L": 0.6,
  "rate_M": 0.8,
  "rate_H": 0.95
}
```

样本集管理中示例条目：

```json
{
  "input_data": { "message": "我想减脂", "intent_hint": "goal" },
  "expected": { "intent": "set_goal" }
}
```

---

## 填写要点

1. 先建样本集再选 ID；本用例关联的集优先展示（若 UI 排序支持）
2. 阈值与 VS-RATE 档位一致，避免 rate_H < rate_M
3. 若启用 Agent Judge，需在验证方案 / 联调配置中打开，本模板本身只绑样本集
