# TPL-DET — 确定性单次

| 项 | 值 |
|----|-----|
| template_code | `TPL-DET` |
| scheme | `TS-01-DET` |
| Panel | `ConfigDetPanel.vue`（`TplDetPanel` 薄封装） |
| 表 | `tpl_config_det` |
| 引擎 | `ts01DetEngine.js` + `detPreflightRunner.js` |
| 典型 VS | VS-01-EXACT / VS-02-CONTRACT |

覆盖最广：A1–A3、B1–B3、D*、多数「单次断言」用例。

---

## 1. 配置项一览

### 1.1 前置接口模板（可选）

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `preflight_api_template_id` | number \| null | 关联带 `preflight_steps` 或 `export_schema` 的接口模板 |
| `preflight_input_params` | object | 按模板 `input_params_schema` 填写 |
| `preflight_include_main_request` | boolean | 默认 `true`；为取 `turn_id` 等可执行模板主请求（submit） |

保存时会清空遗留字段：`use_api_template=false`，`api_template_id=null`，`inject_bindings={}`。

### 1.2 主接口请求

| 配置项 | 说明 |
|--------|------|
| `http_method` | GET/POST/PUT/PATCH/DELETE（可编辑） |
| `endpoint_path` | 相对路径，可含 `{{turn_id}}` |
| `http_status_expected` | 期望状态码 |
| `body` / `test_input_example` | 请求体（`HttpBodyFormItems`） |
| `headers` | 请求头 JSON，合并环境 `global_headers` |
| `assertions` | 可选 `json_path` / `exists` 断言行 |

### 1.3 CLI 模式

当用例为 CLI 执行时，配置页提示直接跑 `automation_command`，无需 HTTP 区。

---

## 2. 前置 → 主请求：字段如何接线

### 2.1 执行顺序

1. 加载全局：`globalRequestContext.headers` + `.vars`（环境 + 项目 manual 变量）
2. 合并 `preflight_input_params` 进变量池
3. 跑接口模板 `preflight_steps`；步骤里 `extract: { var: "$.path" }` 写入 vars
4. 若勾选「执行模板主请求」且主 Path 仍缺关键变量 → 执行模板 submit，再按 `export_schema` 提取
5. 对主请求 `endpoint_path` / `headers` / `body` 做 `{{key}}` 替换
6. 发主请求，做 status + assertions 判定

### 2.2 UI 操作步骤

1. 打开用例配置：`/fitness/items/{itemId}/config/det`
2. **关联模板**：下拉选择接口模板（显示「前置 N 步」）
3. 看「可抛出字段」提示，记下 `session_id`、`turn_id` 等 key
4. 填「前置入参」（若模板声明了 input_params）
5. poll 类用例勾选 **执行模板主请求**
6. 主请求 Path / Body / Headers 写入 `{{抛出字段}}` 与 `{{全局变量}}`

### 2.3 完整举例（poll turn）

**前提**

- 环境 `bff_coach_url` = `http://127.0.0.1:3000`
- `auth_configured.global_headers.Authorization` = `Bearer …`（或用例 Headers 写 `{{token}}`）
- 项目变量 / fixed_params：`coach_id`（若前置需要）
- 接口模板：`coach-chat-submit`，export_schema 含 `session_id`、`turn_id`

**用例 config_json**

```json
{
  "execution_mode": "http",
  "preflight_api_template_id": 12,
  "preflight_input_params": {
    "message": "帮我制定一周训练计划"
  },
  "preflight_include_main_request": true,
  "http_method": "GET",
  "endpoint_path": "/api/chat/turns/{{turn_id}}",
  "http_status_expected": 200,
  "headers": {},
  "body": {},
  "assertions": [
    { "type": "json_path", "path": "$.code", "expect": "TURN_SESSION_INFLIGHT" }
  ]
}
```

含义：

- 前置 bootstrap/submit 派发 `turn_id`
- 主接口 GET poll，Path 用 `{{turn_id}}`
- Authorization 来自环境全局头，用例 Headers 可留空

### 2.4 仅引用全局环境、不关联前置

**场景**：启练类开放 API，只需 openid。

环境 / 变量：

```json
{ "openid": "oa_1E3fSh4Dei_L33BoEHRyLLpQg", "store_code": "123456" }
```

主请求：

```json
{
  "preflight_api_template_id": null,
  "http_method": "POST",
  "endpoint_path": "/miniapp/vipuser/select",
  "http_status_expected": 200,
  "headers": { "Content-Type": "application/json" },
  "body": {
    "openid": "{{openid}}",
    "store_code": "{{store_code}}",
    "pageNumber": 1,
    "pageSize": 10
  }
}
```

`{{openid}}` / `{{store_code}}` 来自项目「全局变量」或环境 `fixed_params`，**无需**前置模板。

### 2.5 Headers 引用全局 Token

```json
{
  "headers": {
    "Authorization": "Bearer {{token}}"
  },
  "body": {
    "session_id": "{{session_id}}"
  }
}
```

| key | 推荐来源 |
|-----|----------|
| `token` | 环境 `fixed_params` 或全局变量 manual；亦可直接写在 `global_headers` 而不用插值 |
| `session_id` | 前置 `export_schema` / extract |

---

## 3. 配置项填写细则

| UI 区 | 正确做法 | 常见错误 |
|-------|----------|----------|
| 关联模板 | 只选有 preflight/export 的模板 | 选空模板却期待自动出 turn_id |
| 前置选项 | poll Path 含 `{{turn_id}}` → 勾选执行主请求 | 未勾选导致 Path 未解析 |
| Path | 写相对路径 + `{{key}}`，不要写死完整域名 | 写绝对 URL 与环境 base 重复 |
| Body | 合法 JSON；插值键与 export 一致 | key 写成 `TurnId` 而 export 是 `turn_id` |
| 期望 Status | submit 常 202，poll/GET 常 200 | submit 填 200 导致误判 |
| 断言 | `json_path` 期望值为字符串比较（注意数字类型） | Path 断言写在 Body 字段上 |

---

## 4. 与 TPL-API-CTX 的边界

| | TPL-DET | TPL-API-CTX |
|--|---------|-------------|
| 主请求 | 用例手写 | 接口模板定义 |
| 样本注入 inject | UI 已关闭 | `ApiInjectBindingsForm` |
| 适用 | 「前置只为取参，主接口另测」 | 「整段走模板流程」 |

需要把文本样本集灌进 message 等多行注入时，用 **TPL-API-CTX**，不要在 DET 找 inject 表单。

---

## 5. 最小验收

- [ ] 不配前置：全局 `{{openid}}` 能打通简单 POST
- [ ] 配前置：`export_schema` 字段出现在配置页「可抛出」列表
- [ ] Path `{{turn_id}}` + 勾选主请求后，run 不再报 UNRESOLVED_PATH_PLACEHOLDER
- [ ] 环境 global_headers 在未知晓的用例 Headers 中仍生效
