# TPL-API-CTX — 前置链路 + 接口模板

| 项 | 值 |
|----|-----|
| template_code | `TPL-API-CTX` |
| scheme | `TS-05-API`（混合场景也可挂在 TS-05-CHAIN） |
| Panel | `ConfigApiCtxPanel.vue` |
| 引擎 | `ts05ChainEngine.js` → `apiTemplateContextRunner` |
| 组件 | `ApiInjectBindingsForm` |

完整复用「接口模板」：前置 → inject → 主请求 → poll/forbidden。

---

## 配置项（用例侧）

| 字段 | 说明 |
|------|------|
| `api_template_id` | 必选，关联 `ft_api_template` |
| `input_params` | 覆盖模板 `input_params_schema` 的外部入参 |
| `inject_bindings` | 按 `inject_schema`：手动值或文本样本集 |
| `use_api_template` | 固定 `true` |
| `use_agent_judge` | 引擎侧可启用 Judge（视 VS/配置） |

**不在本页维护**：`preflight_steps`、`body_template`、`poll_json`、`forbidden_patterns` —— 请到「接口模板管理」编辑。

---

## 1. 外部入参（input_params）

按模板声明的 `bind_to` 写入：

| bind_to | 效果 |
|---------|------|
| `context` | 进变量池，供 `{{key}}` 与前置 |
| `query` / `body` / `path` / `header` | 写入主请求对应部位 |

UI 支持「导入 JSON」批量填入参。

**举例**

```json
{
  "api_template_id": 12,
  "input_params": {
    "coach_id": "c_001",
    "message": "制定增肌计划"
  },
  "inject_bindings": {}
}
```

若项目全局有 `coach_id`：**当前 runner 未必把 `globalRequestContext.vars` 并入初始池**（见缺口）。稳定做法：

- 鉴权放 `global_headers`
- 业务入参在用例 `input_params` 显式填写，或写成模板默认值

---

## 2. 注入字段（inject_bindings）

表单：`ApiInjectBindingsForm`

每个 inject 字段：

| mode | 配置 |
|------|------|
| `manual` | `value` 固定文本 |
| `sample_set` | `sample_set_id` + `field_key`（文本样本集，每行灌一次） |

```json
{
  "inject_bindings": {
    "message": {
      "mode": "sample_set",
      "value": "",
      "sample_set_id": 3,
      "field_key": "message"
    },
    "coach_id": {
      "mode": "manual",
      "value": "c_001",
      "sample_set_id": null,
      "field_key": "coach_id"
    }
  }
}
```

样本集须为「文本」类型；在「样本集管理」创建。本用例 `item_id` 关联的集优先排序。

---

## 3. 与 DET 前置模式对比

| 维度 | TPL-DET + preflight | TPL-API-CTX |
|------|---------------------|-------------|
| 主 Path/Body | 用例写 | 模板写 |
| inject 样本集 | 无 | 有 |
| 适用 | 主接口是另一路径（poll） | 整段模板联调 |

DET 保存时会清空 `inject_bindings`；需要注入请用本模板。

---

## 4. 端到端举例（教练聊天子流程）

1. **接口模板管理**  
   - 配置 preflight：bootstrap session  
   - body_template：`{"message":"{{message}}","session_id":"{{session_id}}"}`  
   - inject_schema：`[{ "key": "message", "location": "body" }]`  
   - export/poll 按需

2. **项目环境**  
   - `global_headers.Authorization = Bearer …`

3. **用例配置 api-ctx**  
   - 选该模板  
   - message → 绑文本样本集「增肌意图 20 条」  
   - coach_id 手动填

4. Launch → 引擎按模板跑前置与主请求，注入样本字段后断言 / Judge

---

## 填写要点

1. 先把接口模板配通（可在模板详情单独调试），再挂用例  
2. inject 字段 key 必须存在于模板 `inject_schema`  
3. 混合大类从 CHAIN 切到本模板时，确认 `template_code=TPL-API-CTX` 已保存
