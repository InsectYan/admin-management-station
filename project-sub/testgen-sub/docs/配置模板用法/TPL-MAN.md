# TPL-MAN — 人工评审

| 项 | 值 |
|----|-----|
| template_code | `TPL-MAN` |
| scheme | `TS-10-MAN` |
| Panel | `ConfigManPanel.vue` |
| 引擎 | `ts10ManEngine.js` |
| 典型 VS | VS-11（多数决） |

无独立大类；常作 A6/C1 的辅方案或专家打分。

---

## 配置项

| 字段 | 说明 |
|------|------|
| `rubric_id` | 量表 / 评分规则 ID |
| `reviewer_count` | 期望评审人数 |

阈值通常为空；通过率由人工提交分值汇总。

另有打分 UI（提交分数），非纯 config_json 字段。

---

## 全局环境与前置

- **基本不依赖** HTTP 插值与前置模板  
- 评审对象关联 Run / item，展示上下文（Run #、item_id）  
- Agent 配置生成：`agent_skill` 多为空，无 AI 一键生成本模板配置

---

## 配置举例

```json
{
  "rubric_id": "uat-coach-reply-v1",
  "reviewer_count": 3
}
```

流程：保存配置 → 关联待审 Run → 多名评审打分 → VS-11 多数决。

---

## 填写要点

1. 先维护 rubric 数据，再填 ID  
2. 与 TPL-SET（自动 Golden）可同时挂主/辅方案  
3. 打分提交流程与 Agent 预审能力见缺口文档（部分节点仍在推进）
