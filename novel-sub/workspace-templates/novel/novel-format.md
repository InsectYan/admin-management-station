# 小说与大纲格式

## novel_data

- `title`: 标题
- `summary`: 200–500 字梗概
- `content`: 正文（Markdown）
- `chapters`: 可选，`[{ "index", "title", "beats" }]`

## outline_data

- `logline`: 一句话故事
- `acts`: `[{ "act", "title", "summary" }]`
- `chapter_beats`: `[{ "chapter", "title", "beats": string[] }]`

## task_list_data

- `tasks`: `[{ "id", "title", "description", "priority", "depends_on"? }]`
