# SKILL：结构化生成 `novel-writer-skill`

> 落点：`agent-management-sub/plugins/novel-writer-skill/`  
> `scheme`：默认 `react`（短步）；`fill_characters` / `fill_outline` 过长可改 `loop`  
> 职责：把用户话 + 头脑风暴 sparks + 表单快照收成 **可 merge 的 patch**

字段名必须与 `frontend/src/utils/novelCreateSchema.js` 一致。对照表可放 `lib/schemaHints.js`。

---

## 1. 前端 / 服务端

前端只消费坞；BFF `agentProxy.invokeWriter(payload)` → `POST /api/skills/novel-writer-skill/invoke`。

payload 必带：`action`、`message`、`target_fields`、`form_snapshot`、`enum_catalog`、`sparks`（可空）、`prior_applied`（已应用摘要）。

---

## 2. Agent

### 2.1 目录

```
novel-writer-skill/
  index.js
  SKILL.md
  templates/react-system.md
  lib/schemaHints.js
```

### 2.2 action

| action | 对应组件 | patch 形状 |
|--------|----------|------------|
| `fill_basic` | 03 | `title`、`creative_intent`、`summary` |
| `fill_world` | 04 | `createWorldForm()` + `timeline[]` |
| `fill_characters` | 05 | `{ characters, character_edges }` |
| `fill_outline` | 06 | `{ volumes }` |
| `fill_chapters` | 07 | `{ chapters }` 无 order |
| `fill_factions` | 10 | `{ factions }` |
| `fill_chapter_body` | 11 | `{ body }`；须衔接 `prev_chapter.ending`，靠近 `word_target`，不得复述上一章，不得剧透 `next_outline` 以外的后文 |
| `rewrite_field` | 任意 | `{ [path]: value }` 仅含 target |
| `chat_to_fields` | 坞通用 | 根据 message + target 选上述之一；BFF 也可自己选 action |

推荐：BFF 按 `feature_key` 定 action，不要让 LLM 再选一次 action（减少跑偏）。`chat_to_fields` 仅当 feature 内多 action 时使用。

### 2.3 出参（坞契约）

```json
{
  "thinking": "",
  "reply": "",
  "target_fields": ["title"],
  "patch": {}
}
```

枚举只许出现在 `enum_catalog` 内。`enrichContext` 注入 catalog 短表。`formatResponse` 后 BFF 再校验一遍。

`target_fields` 必须 ⊆ 请求中的允许列表或本步 catalog；识别到额外字段时放入 `suggested_fields`，由前端待确认，**不要**写进 patch。

---

## 3. 验收

- [ ] 无 sparks 时仍能根据 message + 空表单出 `fill_basic`
- [ ] 有 sparks 时 patch 明显吸收火花用词
- [ ] 伪造 `theme_ids` 被 BFF 拒绝
