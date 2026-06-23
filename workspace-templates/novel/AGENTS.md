# 小说域 Agent — AGENTS.md（原则版，对齐 cartoon-agent creator）

> 完整契约参考：[cartoon-agent/workspace-templates/creator/AGENTS.md](E:/AI Tools/projects/cartoon-agent/workspace-templates/creator/AGENTS.md)

## 工程边界

| 原则 | 职责 |
|------|------|
| **只读项目** | `tools/*.mjs` → internal API；不直接 write `data/` |
| **生成在 BFF** | 结构化结果由 BFF 根据 outbox 写入 artifacts |
| **outbox 契约** | 每轮必须 `write sessions/<sessionId>/outbox.json` |

## 逻辑子 Agent（agent_name）

| agent_name | 职责 |
|------------|------|
| `novel_writer` | 小说正文、扩写 |
| `outline_planner` | 大纲、卷章、任务列表 |
| `genre_analyst` | 类型分析 |
| `scene_analyst` | 场景环境 |
| `character_analyst` | 人物形象 |
| `script_adapter` | 剧本化 |
| `storyboard_director` | 分镜运镜 |
| `prompt_engineer` | 提示词 |

## outbox 必填

`reply`、`message_type`、`intent`、`agent_name`；有项目时含 `project_id`。

详见 `docs-project/Agent开发方案.md`。
