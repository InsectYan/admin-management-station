# TPL-CHAIN — 多步链路

| 项 | 值 |
|----|-----|
| template_code | `TPL-CHAIN` |
| scheme | `TS-05-CHAIN` |
| Panel | `ConfigChainPanel.vue` |
| 引擎 | `ts05ChainEngine.js`（chain 分支） |
| 典型 VS | VS-04-CHAIN-OK |

手写多步 HTTP/CLI，步骤间 `extract` 传递变量（A4、B6、G4、G7 等）。

---

## 配置项

| 字段 | 说明 |
|------|------|
| `execution_mode` | 固定 `"chain"` |
| `steps[]` | 步骤表（见 ChainStepTable） |
| `vars` | 初始变量（可与全局合并情况见缺口） |

步骤常用列：

| 列 | 说明 |
|----|------|
| method / path 或 command | 请求或 CLI |
| expect_status | 期望码 |
| body / headers | 可写 `{{key}}` |
| extract | 多行 `varName:$.json.path` |

UI 提示：「支持 `{{key}}` 插值；extract 多组格式 var:$.path，换行分隔。」

---

## 全局环境如何进链路

| 能力 | 现状 |
|------|------|
| global_headers | 矩阵行执行会 merge |
| 项目变量 / fixed_params | **与 DET 不同**：初始 vars 常为 `config_json.vars` + 内置，`globalRequestContext.vars` **未必自动并入**（见缺口文档） |

**实操建议**：在「初始 vars」或第 0 步 body 中显式写入关键值，或把稳定 Token 放在 **global_headers**（不依赖插值）。

---

## 配置举例

```json
{
  "execution_mode": "chain",
  "vars": {
    "openid": "{{openid}}"
  },
  "steps": [
    {
      "name": "login",
      "method": "POST",
      "path": "/miniapp/user/get-info",
      "expect_status": 200,
      "body": { "openid": "{{openid}}" },
      "extract": "openid:$.data.openid\nphone:$.data.phone"
    },
    {
      "name": "list_vip",
      "method": "POST",
      "path": "/miniapp/vipuser/select",
      "expect_status": 200,
      "body": {
        "create_user_phone": "{{phone}}",
        "store_code": "123456",
        "pageNumber": 1,
        "pageSize": 10
      }
    }
  ]
}
```

若引擎未把全局 `openid` 注入初始 vars，请在用例 `vars` 填具体值，或依赖 headers 鉴权。

---

## 与 TPL-API-CTX

| | CHAIN | API-CTX |
|--|-------|---------|
| 步骤定义 | 用例 steps | 接口模板 preflight + 主请求 |
| 适合 | 一次性、定制链路 | 多用例复用同一套模板 |
| 混合切换 | C1–C4 可在详情页切换 | 同左 |

---

## 填写要点

1. extract 变量名与下一步 `{{name}}` 严格一致
2. 第一步失败会阻断后续；先单步探测 status
3. 需要样本注入时优先转 API-CTX，而不是在 CHAIN 手写样本循环
