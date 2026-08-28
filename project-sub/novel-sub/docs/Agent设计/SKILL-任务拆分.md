# SKILL：任务拆分 `novel-orchestrator-skill`

> 落点：`agent-management-sub/plugins/novel-orchestrator-skill/`  
> `scheme`：`loop`，`maxSteps=3`：`inspect` → `plan` → `review`  
> 使用方：仅 [08-总任务拆分](./08-总任务拆分.md)  
> **不写** 书名、人物、大纲正文；**不** invoke 其他 Skill

平台主 Agent 的「统一流水线」不是本 Skill。本 Skill 只产出业务 plan。

---

## 1. 前端 / 服务端

turns `pipeline: ["orchestrator"]`。执行某步：BFF `POST /api/ai/dispatch` 再开目标 `feature_key` 的 writer 流水线。

---

## 2. Agent

### 2.1 目录

```
novel-orchestrator-skill/
  index.js
  SKILL.md
  templates/loop-system.md
```

可选 `db/init.sql`：若要在 Agent 库留 run；计划正文仍以 novel 会话 `patch_json` 为准。

### 2.2 action

| action | 入参 | 出参 |
|--------|------|------|
| `plan` | `intent`、`coverage`（各步是否已有内容）、`enum_catalog` 短 | `tasks[]`、`rationale`、`thinking` |
| `replan` | 旧 tasks + 失败/跳过原因 | 新 `tasks[]` |

`coverage` 由 BFF 算，例如 `{ basic: true, world: false, ... }`，Skill 不要自己猜库。

### 2.3 task

```json
{
  "id": "t_world",
  "path": "plan.world",
  "step": 2,
  "feature_key": "world",
  "writer_action": "fill_world",
  "depends_on": ["t_basic"],
  "reason": "世界观为空",
  "status": "pending"
}
```

`status`：`pending` | `skip`（该步已有内容）| `optional_rewrite`。默认 skip 已有内容，除非用户 intent 明确「全部重来」。

依赖必须：basic → world → characters → outline → content。

### 2.4 回调

`enrichContext`：intent + coverage。`persistResult` 可选。禁止在 callback 里 curl writer。

---

## 3. 验收

- [ ] 已有 world 时对应 task 为 `skip`
- [ ] 输出不含 `characters[]` 全文
- [ ] `GET /api/plugins` 可见
