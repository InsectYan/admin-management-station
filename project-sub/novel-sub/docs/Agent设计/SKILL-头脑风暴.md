# SKILL：头脑风暴 `novel-brainstorm-skill`

> 落点：`agent-management-sub/plugins/novel-brainstorm-skill/`（运行时挂 master）  
> `scheme`：`react`，`maxSteps ≤ 2`  
> 复用：书名、立意、世界观钩子、**人物第一道**、大纲情节点、可选章名  
> **禁止**：输出表单 id、枚举主键、完整 `setting_json`

这是「畅想」层。结构化写入一律交给 [SKILL-结构化生成](./SKILL-结构化生成.md)。BFF 用 `pipeline` 串行，本 Skill **不要** HTTP 调 writer。

---

## 1. 前端 / 服务端

无独立 UI。只被 `POST /api/ai/sessions/:id/turns` 按 pipeline 调用。

---

## 2. Agent

### 2.1 目录

```
novel-brainstorm-skill/
  index.js
  SKILL.md
  templates/ideate-system.md
```

可不建业务表；发散结果进 novel_db 的 `novel_ai_messages`。

### 2.2 action

| action | 入参 | 出参 |
|--------|------|------|
| `ideate` | `message`、`focus`、`form_digest`、`prior_sparks?` | `thinking`、`reply`、`sparks[]`、`suggested_fields[]` |

`focus`：`title` | `intent` | `world` | `cast` | `plot` | `chapter_titles` | `auto`（从 message 判断）

`sparks[]` 示例：

```json
{ "kind": "title", "text": "候选书名或人设一句话", "note": "为何适合当前类型" }
```

`suggested_fields`：给坞做待确认主题，如 `["title"]`、`["characters"]`。

### 2.3 回调

- `enrichContext`：拼接 focus、用户话、表单摘要（立意/类型/已有角色名）、历史 sparks
- `formatResponse`：固定 JSON，不要 Markdown 混在 patch 里
- 不读 env apiKey；模型走 `resolveLlm`

温度可略高于 writer（创意），仍要 `jsonSchemaHint`。

---

## 3. 验收

- [ ] `GET /api/plugins` 含本 Skill
- [ ] `ideate` + `focus=cast` 不含 `character_edges`、不含数字 id
- [ ] 同一 Skill 被 03 与 05 调用，仅 `focus` 不同
