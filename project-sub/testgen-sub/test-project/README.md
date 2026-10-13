# 三端测试项目（FE / BE / AG）

| 项目 | 目录 | project_code |
|------|------|--------------|
| 前端 | [lejian-wx-miniapp/](./lejian-wx-miniapp/) | `lejian-wx-miniapp` |
| 服务端 | [lejian-business-service/](./lejian-business-service/) | `lejian-business-service` |
| Agent | [fitness-agent/](./fitness-agent/) | `fitness-agent` |

- **用例目录 MD**：[triad-cases.md](./triad-cases.md)
- **注入脚本**：[import-triad-cases.mjs](./import-triad-cases.mjs) + [cases-all.json](./cases-all.json)
- **生成器**：[scripts/generate-triad-cases.mjs](./scripts/generate-triad-cases.mjs)
- **规则**：上游 `fitness-agent-test-docs`（T1–T12）

```bash
node test-project/scripts/generate-triad-cases.mjs
# 然后 db:reset 或 node test-project/import-triad-cases.mjs
```
