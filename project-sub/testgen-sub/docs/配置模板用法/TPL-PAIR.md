# TPL-PAIR — 对照对比

| 项 | 值 |
|----|-----|
| template_code | `TPL-PAIR` |
| scheme | `TS-06-PAIR` |
| Panel | `ConfigPairPanel.vue` |
| 引擎 | `ts06PairEngine.js` |
| 典型 VS | VS-03-ZERO |

多角色 / 多端口径对照（G6、C2/C3 部分）。

---

## 配置项

`config_json.pairs[]`：

| 字段 | 说明 |
|------|------|
| `role` | 角色标签，如 coach / member / manager |
| `path` | 请求路径 |
| `method` | HTTP 方法 |
| `expect_status` | 期望状态码 |
| `forbidden_patterns` | 响应中禁止出现的模式（字符串列表） |

---

## 全局环境

- 共用同一执行环境主机与 `global_headers`
- 若三角色 Token 不同：当前模板**无** per-pair Authorization UI，需  
  - 在 path 区分 BFF，或  
  - 用不同环境跑分次，或  
  - 在引擎扩展前暂时用 CHAIN 分步换头

`{{token}}` 若仅有一个全局变量，三行将共用同一凭证——设计用例时注意。

---

## 配置举例

```json
{
  "pairs": [
    {
      "role": "coach",
      "method": "GET",
      "path": "/api/coach/home",
      "expect_status": 200,
      "forbidden_patterns": ["member_only"]
    },
    {
      "role": "member",
      "method": "GET",
      "path": "/api/member/home",
      "expect_status": 200,
      "forbidden_patterns": ["coach_admin"]
    },
    {
      "role": "manager",
      "method": "GET",
      "path": "/api/manager/home",
      "expect_status": 200,
      "forbidden_patterns": []
    }
  ]
}
```

---

## 填写要点

1. `role` 仅用于结果展示分组，不自动换 JWT——换凭证靠环境或后续增强  
2. `forbidden_patterns` 做零出现（VS-03）类断言  
3. 复杂会话态优先前置数据准备，而非 PAIR 内嵌链路
