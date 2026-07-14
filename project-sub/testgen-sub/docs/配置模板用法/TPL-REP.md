# TPL-REP — 重复抽样

| 项 | 值 |
|----|-----|
| template_code | `TPL-REP` |
| scheme | `TS-03-REP` |
| Panel | `ConfigRepPanel.vue` |
| 引擎 | `ts03RepEngine.js` |
| 典型 VS | VS-08-PASSK* |

用于 LLM/非确定性接口的 Pass@k（E2/E3/E4、G1 等）。

---

## 配置项

| 字段 | 说明 |
|------|------|
| `repeat_count` | 重复次数 N |
| `runner` | `http` / `cli` |
| `path` / `method` / `expect_status` / `body` / `headers` | HTTP 分支 |
| `command` | CLI 分支 |

阈值 `threshold_json`：

| 字段 | 说明 |
|------|------|
| `passk_N` | 总次数（常与 repeat_count 对齐） |
| `passk_M` | 至少成功次数 |

---

## 全局环境引用

与 DET 类似：Headers 合并 `global_headers`；Body/Path 可用 `{{token}}`、`{{openid}}`。  
当前 Panel **未**提供「关联前置接口模板」；需要会话上下文时：

1. 把前置得到的 `session_id` 事先写入全局变量 / fixed_params，或  
2. 改用 **TPL-CHAIN** / **TPL-API-CTX** 做链路后再对结果做抽样（视产品方案）

---

## 配置举例

```json
{
  "repeat_count": 10,
  "runner": "http",
  "method": "POST",
  "path": "/api/chat/submit",
  "expect_status": 202,
  "headers": {
    "Authorization": "Bearer {{token}}"
  },
  "body": {
    "message": "深蹲的标准动作是什么？",
    "session_id": "{{session_id}}"
  }
}
```

```json
{
  "passk_N": 10,
  "passk_M": 7
}
```

含义：10 次中至少 7 次成功视为通过。

---

## 填写要点

1. `passk_M` ≤ `passk_N` ≤ 可接受耗时上限
2. CLI 与 HTTP 不要混在同一份字段里填两套冲突值
3. 非确定性接口期望 Status 可放宽，具体判据交给 VS/断言
