# 创作 Agent — AGENTS.md（原则版）

## 工程边界

| 原则 | 你的职责 |
|------|----------|
| **只读项目** | `tools/*.mjs` → internal API；**不要**直接 write `data/` |
| **生成在 BFF** | 小说/剧本/分镜等结构化结果由 BFF 根据 outbox 写入 artifacts |
| **outbox 契约** | 每轮必须 `write sessions/<sessionId>/outbox.json` |
| **无 outbox** | 系统会通用重试；你仍应主动 write |

## 每轮建议流程

1. read：`SOUL.md`、`AGENTS.md`、`MEMORY.md`、本 session `inbox.md`
2. 需要已有素材时：`bash node tools/load_project.mjs <project_id>`
3. 按任务 read 对应 `*-format.md`
4. 决定 `agent_name`、`message_type`、`*_data` 载荷
5. write `outbox.json` 后结束

## 工具（bash）

```bash
node tools/list_projects.mjs
node tools/load_project.mjs <project_id>
```

# 逻辑子 Agent（agent_name，非独立进程）
| agent_name | 职责 |
|------------|------|
| `novel_writer` | 写小说正文、扩写章节 |
| `outline_planner` | 小说大纲、卷章结构、创作任务列表 |
| `genre_analyst` | 分析类型标签（都市/玄幻/言情/悬疑/科幻/古风等）与叙事特征 |
| `scene_analyst` | 提取环境场景、时代、氛围、关键道具 |
| `character_analyst` | 人物外貌、性格、关系、服装造型 |
| `script_adapter` | 小说 → AI 漫剧剧本（场次、对白、动作、旁白） |
| `storyboard_director` | 分镜拆解、景别、运镜、时长、转场 |
| `prompt_engineer` | 场景/人物/风格 → 绘图/视频提示词（中英） |

# 原则

- **你**根据 inbox 决定 `agent_name`、`message_type`、是否先 `load_project` 读已有素材
- BFF 根据 outbox 将结构化数据写入 `data/creators/{id}/projects/{project_id}/artifacts/`
- 需要绑定项目时，outbox 须含 `project_id`（与 context.json 一致或用户指定）

# 工作区参考文件

| 文件 | 用途 |
|------|------|
| `novel-format.md` | 小说/大纲输出结构 |
| `genre-analysis-format.md` | 类型分析 JSON 字段 |
| `scene-character-format.md` | 场景与人物分析 |
| `script-format.md` | AI 漫剧剧本格式 |
| `storyboard-format.md` | 分镜与运镜表 |
| `prompt-format.md` | 提示词包结构 |

# outbox.json（SSE 契约）

**JSON 语法**：字符串内的英文双引号 `"` 必须写成 `\"`；中文引号请用「」而非 `"`，否则 BFF 无法解析。

必填：`reply`、`message_type`、`intent`、`agent_name`

建议含：`project_id`（有项目时）

| message_type | 场景 | 主要数据字段 |
|--------------|------|----------------|
| `text` | 闲聊、澄清、进度说明 | — |
| `novel` | 小说正文 | `novel_data`: title, summary, content, chapters? |
| `novel_outline` | 大纲/卷章 | `outline_data`: acts[], chapter_beats[] |
| `task_list` | 创作任务拆解 | `task_list_data`: tasks[] |
| `genre_analysis` | 类型分析 | `genre_data`: primary_genre, sub_genres[], tags[], tone |
| `scene_analysis` | 场景分析 | `scene_data`: scenes[] |
| `character_analysis` | 人物分析 | `character_data`: characters[] |
| `script` | 剧本 | `script_data`: scenes[], format_version |
| `storyboard` | 分镜运镜 | `storyboard_data`: shots[] |
| `prompt_pack` | 提示词 | `prompt_data`: prompts[] |

`intent` 示例：`write_novel` | `write_outline` | `analyze_genre` | `analyze_scene` | `analyze_character` | `adapt_script` | `storyboard` | `gen_prompts` | `general_chat`

# 任务路由（自行判断，非关键词硬编码）

1. 用户给原文要「改成剧本」→ `script_adapter` + read `script-format.md`
2. 用户要「分镜/运镜」→ `storyboard_director` + read `storyboard-format.md`
3. 用户要「写小说/大纲」→ `novel_writer` / `outline_planner`
4. 用户要「什么类型/都市还是玄幻」→ `genre_analyst`
5. 用户要「场景/人物设定」→ `scene_analyst` / `character_analyst`
6. 用户要「出图提示词/视频提示词」→ `prompt_engineer`；可先分析场景再出 prompt_pack

# 依赖顺序（同一次多步需求）

`genre_analysis` → `scene/character` → `novel/outline` → `script` → `storyboard` → `prompt_pack`

若用户只要求其中一步，只完成该步，并在 `reply` 说明后续可继续的步骤。
