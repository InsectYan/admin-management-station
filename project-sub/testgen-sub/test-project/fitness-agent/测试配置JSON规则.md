# fitness-agent-test-json 配置输出规则

> 生成脚本：`scripts/generate-test-json-configs.mjs`  
> 输出目录：仓库根 `fitness-agent-test-json/{item_id}/`

## 目录结构

| 文件 | 含义 |
|------|------|
| `master.json` | 主方案 `scheme_primary_id` 对应的 `config_json`（可直接导入配置页） |
| `sub.json` | 辅助方案 `scheme_secondary_id` 的 `config_json`（仅当 item 有 secondary 时生成） |
| `threshold.json` | 主方案 `threshold_json`（VS 默认阈值） |
| `threshold-sub.json` | 辅助方案阈值 |
| `_manifest.json` | 全量索引（item_id、TS、模板、是否已有 automation） |

## 方案 → 模板 → master.json 形状

| TS | 模板 | master.json 顶层字段 |
|----|------|----------------------|
| TS-01-DET | TPL-DET | `endpoint_path` / `http_method` / `http_status_expected` / `body`；或有 `runner:cli` + `command` |
| TS-02-BND | TPL-BND | `{ "matrix": [ { name, runner, path\|command, ... } ] }` |
| TS-03-REP | TPL-REP | `repeat_count`, `runner`, `path`, `method`, `expect_status`, `command?` |
| TS-04-SET | TPL-SET | `{ "sample_set_id": null, "_note": "..." }` |
| TS-05-CHAIN | TPL-CHAIN | `{ "vars": {}, "steps": [ ... ] }` |
| TS-06-PAIR | TPL-PAIR | `{ "pairs": [ { role, path, method, expect_status, forbidden_patterns } ] }` |
| TS-07-NEG | TPL-NEG | `{ "cases": [...], "block_rate_min" }` |
| TS-08-OBS | TPL-OBS | `{ "checks": [ { mode, path?, ... } ] }` |
| TS-09-LOAD | TPL-LOAD | `{ vu, duration_sec, path, method, body? }` |
| TS-10-MAN | TPL-MAN | `{ rubric_id, reviewer_count }` |

## 内容优先级

1. **手工种子**：`database/tables/tpl_config_*`（如 `B4-PERSIST-001` 九行 persist 矩阵）
2. **保留目录**：`PRESERVE_DIRS` 中已有 `master.json` / `sub.json` 不覆盖
3. **自动化命令**：`automation_command` → CLI 矩阵行或 REP/CHAIN 首步
4. **HTTP 字段**：`endpoint_path` + `http_method` + `http_status_expected` + `test_input_example`
5. **业务默认**：CHAIN 预置 session→submit→poll；OBS 从 `assertion_points` 推断 checks

## 何时需要书写配置

| 条件 | 是否生成 |
|------|----------|
| `is_active = false` | 否 |
| `TS-10-MAN` | 是（rubric 占位） |
| 有 `automation_command` | 是（优先 CLI） |
| 非 DET 方案 | 是（必须可配置执行） |
| 仅 DET 且无 endpoint/command | 是（/health 探针占位 + `_note`） |

## 导入平台

- **边界矩阵**：导入 `master.json`（含 `matrix` 数组）
- **链路**：导入 `master.json` 的 `steps`（需面板支持 steps 导入时扩展）
- **阈值**：手动粘贴 `threshold.json` 或配置页填写

## 重生成

```bash
cd admin-management-station/project-sub/testgen-sub
node test-project/fitness-agent/scripts/generate-test-json-configs.mjs
node test-project/fitness-agent/scripts/generate-test-json-configs.mjs --item B4-GATE-M-001
```
