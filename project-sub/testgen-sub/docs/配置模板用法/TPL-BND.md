# TPL-BND — 边界矩阵

| 项 | 值 |
|----|-----|
| template_code | `TPL-BND` |
| scheme | `TS-02-BND` |
| Panel | `ConfigBndPanel.vue` |
| 引擎 | `ts02BndEngine.js` + `matrixRowRunner` |
| 典型 VS | VS-02-CONTRACT |

适用于多组边界载荷 / 状态转移行（B4、G5、C4 等）。

---

## 配置项

`config_json.matrix[]` 每一行：

| 字段 | 说明 |
|------|------|
| `runner` | `http` 或 `cli` |
| `path` / `command` | HTTP 路径或 CLI 命令 |
| `method` | GET/POST…（http） |
| `expect_status` | 期望状态码 |
| （可选）`body` / `headers` | 部分实现可能扩展；以 Panel 实际字段为准 |

阈值：`threshold_json` 通常为空对象，逐行 pass/fail 汇总。

---

## 如何引用全局环境

- Headers：矩阵行执行时经 `mergeRequestHeaders` 合并环境 `global_headers`
- Path/Body 中的 `{{key}}`：依赖引擎传入的 vars；**推荐把稳定业务键放在环境 `fixed_params` 或全局变量**，并在行 path/body 写 `{{key}}`
- 注意：相对 DET，BND 对「前置接口模板关联」支持较弱——复杂会话态更建议行列内写死已知 id，或改用 CHAIN/API-CTX

---

## 配置举例

```json
{
  "matrix": [
    {
      "runner": "http",
      "method": "POST",
      "path": "/api/pipeline/persist",
      "expect_status": 200,
      "body": { "message_type": "plan_form", "coach_id": "{{coach_id}}" }
    },
    {
      "runner": "http",
      "method": "POST",
      "path": "/api/pipeline/persist",
      "expect_status": 400,
      "body": { "message_type": "unknown_type" }
    }
  ]
}
```

全局变量需预先有 `coach_id`。逐行期望不同 status，用于边界/契约矩阵。

---

## 填写要点

1. 同一 path 多行时用 body 差异区分边界
2. CLI 行写完整 `command`，不依赖 HTTP base_url
3. 失败行会在结果表高亮；先保证环境探活通过再批量矩阵
