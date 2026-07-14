# TPL-NEG — 对抗专项

| 项 | 值 |
|----|-----|
| template_code | `TPL-NEG` |
| scheme | `TS-07-NEG` |
| Panel | `ConfigNegPanel.vue` |
| 引擎 | `ts07NegEngine.js` |
| 典型 VS | VS-09-BLOCK-* |

注入 / 医疗越权 / 隐私对抗（E5、E_RISK 等）。

---

## 配置项

`config_json.cases[]`：

| 字段 | 说明 |
|------|------|
| `path` | 攻击或探针路径 |
| `method` | HTTP 方法 |
| `expect_blocked` | 是否期望被拦截 |
| `block_statuses` | 视为「已拦截」的状态码列表 |

阈值：

| 字段 | 说明 |
|------|------|
| `block_rate_min` | 最低拦截率 |

---

## 全局环境

- Headers：合并环境全局头（合法内部 Key 可能用于打到门禁层）  
- Path/Body：若 Panel 暴露 body 字段，可对敏感字段用 `{{openid}}`；多数对抗文案写在 cases 行内  
- **无**前置模板关联；危险 payload 直接写死在 cases

---

## 配置举例

```json
{
  "cases": [
    {
      "method": "POST",
      "path": "/api/chat/submit",
      "expect_blocked": true,
      "block_statuses": [400, 403, 422]
    },
    {
      "method": "POST",
      "path": "/api/chat/submit",
      "expect_blocked": true,
      "block_statuses": [400, 403, 422]
    }
  ]
}
```

```json
{
  "block_rate_min": 0.9
}
```

对抗正文通常在引擎/样本或扩展 body 字段中；以当前 Panel 可见字段为准，必要时对照 `ts07NegEngine`。

---

## 填写要点

1. `expect_blocked=true` 时必须配置合理的 `block_statuses`  
2. 勿在生产环境跑真实有害 payload  
3. 拦截率阈值与 VS-09 档位对齐
