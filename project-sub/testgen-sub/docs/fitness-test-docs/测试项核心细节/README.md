# 测试项核心细节（仅 .pi）

> **版本**：2026-07-29 · **条目**：95 · **真源**：`fitness-agent/.pi`
>
> 已废弃旧 A–H 六站/套壳/RDS/压测用例。本目录只描述 Agent（Pi）行为与契约。

| 文件 | 内容 |
|------|------|
| [PI-场景与角色.md](./PI-场景与角色.md) | scene_code / 角色围栏 |
| [PI-emit契约.md](./PI-emit契约.md) | emit_outbox / 一轮一 UI |
| [PI-教练工作流.md](./PI-教练工作流.md) | 计划/课时/总结/删除/安全 |
| [PI-会员与店长.md](./PI-会员与店长.md) | member / manager 边界 |
| [PI-咨询技能.md](./PI-咨询技能.md) | 咨询 skill 与高风险 |
| [PI-记忆工具思考.md](./PI-记忆工具思考.md) | memory / tools / thinking |
| [PI-HTTP与静态守卫.md](./PI-HTTP与静态守卫.md) | .pi HTTP + 工程单测 |

自动化优先：`cd fitness-agent/.pi && npm test`。
