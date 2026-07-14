# TPL-LOAD — 压测容量

| 项 | 值 |
|----|-----|
| template_code | `TPL-LOAD` |
| scheme | `TS-09-LOAD` |
| Panel | `ConfigLoadPanel.vue` |
| 引擎 | `ts09LoadEngine.js`（进程内并发 HTTP） |
| 典型 VS | VS-10-SLO-* |

A5 / F1 / F2 / F6 等容量与时延。

---

## 配置项

| 字段 | 说明 |
|------|------|
| `vu` | 虚拟用户 / 并发度 |
| `duration_sec` | 持续时间（秒） |
| `path` | 压测路径 |
| `method` | HTTP 方法 |
| body（若 Panel 提供） | 固定请求体 |

阈值：

| 字段 | 说明 |
|------|------|
| `p99_max_ms` | P99 上限 |
| `error_rate_max` | 错误率上限 |

UI 可 **导出 k6 脚本**；引擎本身是内置并发压测，**不是**外部 k6 进程（见缺口文档）。

---

## 全局环境

- 使用执行环境主机发请求  
- **多数情况下不会**像 DET 一样完整走 `{{var}}` 插值与全局变量池；鉴权依赖引擎是否读取 global headers  
- **实操**：把稳定 Authorization 配进环境 `global_headers`；避免压测 path 依赖动态 `{{turn_id}}`

---

## 配置举例

```json
{
  "vu": 10,
  "duration_sec": 30,
  "method": "POST",
  "path": "/api/chat/submit"
}
```

```json
{
  "p99_max_ms": 2000,
  "error_rate_max": 0.05
}
```

---

## 填写要点

1. 本地联调 VU 与 duration 宁小勿大，防打挂依赖服务  
2. 导出 k6 脚本用于外部跑时，需自行改 base URL / 头  
3. 与「真实 k6 集成」里程碑区分：当前验收入口是平台引擎结果
