# TPL-OBS — 可观测稽核

| 项 | 值 |
|----|-----|
| template_code | `TPL-OBS` |
| scheme | `TS-08-OBS` |
| Panel | `ConfigObsPanel.vue` |
| 引擎 | `ts08ObsEngine.js` |
| 典型 VS | VS-05-PRESENCE |

journey / HTTP 字段存在性 / 可观测链路（H*、F3、G8）。

---

## 配置项

`config_json.checks[]`：

| 字段 | 说明 |
|------|------|
| `mode` | `http_fields` \| `journey_list` \| `journey_get` |
| `path` | HTTP 探针路径（http_fields） |
| `required_fields` / `fields` | 必填字段列表 |
| `session_id` / `client_turn_id` | journey 查询键 |
| `limit` | journey 列表条数等 |

阈值：`require_complete`（是否要求完整链路）。

---

## 全局环境与前置字段

- HTTP 探针：Headers 合并全局头；`path` 可写相对路径  
- `session_id` 等：**优先写 `{{session_id}}`**——但 OBS 引擎是否做插值取决于实现；若未插值，请粘贴真实 ID，或用 DET 前置跑出后手工填入  
- 推荐联调流：先用 TPL-DET/API-CTX 产生 session → 把 ID 写入全局 `fixed_params.session_id` → OBS 勾选同一环境

---

## 配置举例

```json
{
  "checks": [
    {
      "mode": "http_fields",
      "path": "/api/observability/health",
      "required_fields": ["status", "version"]
    },
    {
      "mode": "journey_get",
      "session_id": "{{session_id}}",
      "client_turn_id": "{{turn_id}}",
      "required_fields": ["events", "started_at"]
    }
  ]
}
```

```json
{
  "require_complete": true
}
```

---

## 填写要点

1. mode 与字段组合匹配：journey_* 必须有会话键  
2. 可观测基座（Jaeger/journey API）需环境可达，否则 skip/fail  
3. H 维度多检查项共用本模板，避免把业务断言硬塞进 OBS
