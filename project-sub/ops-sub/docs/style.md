# 运维子应用清新森林风 — 可行样式规范

视觉与小说平台一致：叶绿为主、半透明表面、分页面景观勾勒。令牌挂在 `.ops-sub-root`，类名前缀 `ops-*`。

完整约束见 [`.cursor/rules/ops-sub-style.mdc`](../../../.cursor/rules/ops-sub-style.mdc) 与小说平台 `novel-sub/docs/style.md`。

| 页面 | 路由 | 景观 |
|------|------|------|
| 项目信息列表 | `ops-list` | `ops-scene--meadow` |
| 新建项目 | `ops-create` | `ops-scene--grove` |
| 项目详情 / 编辑 | `ops-detail` / `ops-edit` | `ops-scene--lake` |
| 部署操作 | `ops-deploy` | `ops-scene--dusk` |
| 部署历史 / 任务总览 | `ops-deploy-history` / `ops-deploy-jobs` | `ops-scene--meadow` |
| 部署黑窗口 | `ops-deploy-log` | `ops-scene--night`（仅日志容器深色，外壳仍用森林令牌） |

AntV 容器类名：`ops-antv-forest`。色板：叶绿 `#2F8A5B`、苔灰 `#6D8A82`、接口绿 `#5BA87C`、判断青 `#4A90A4`。风险/警告是节点标注（红/橙描边），不是节点类型。
