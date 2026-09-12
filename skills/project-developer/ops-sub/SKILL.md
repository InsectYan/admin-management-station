---
name: ops-sub-developer
description: >-
  在 ops-sub（app_key=ops）上按运维规划迭代：项目列表、JSON 模板导入导出、
  详情目录树 / 路由 / AntV X6 功能流程图。样式对齐小说平台森林风。
  未涉及 Agent 时不要改 agent-management-master。
  当用户在 ops-sub 目录开发、引用运维大纲时使用。
---

# Ops Sub — Project Developer

在 **`project-sub/ops-sub/`** 上按设计文档驱动业务开发。通用脚手架见 [`../../sub-app-developer/SKILL.md`](../../sub-app-developer/SKILL.md)。

## 应用标识

| 项 | 值 |
|----|-----|
| `app_key` | `ops` |
| 显示名 | 运维管理平台 |
| 根目录 | `project-sub/ops-sub/` |
| CLI | `ams-ops` |
| 端口 | Vite **5103** / BFF **5203** / PG **5303** / `ops_db` |
| 设计文档 | [`ops-sub/docs/`](../../../project-sub/ops-sub/docs/) |
| 需求大纲 | 仓库 `需求设计文档/运维初始版大纲.md` |

## 本期范围

- 项目管理：列表、导入、导出配置、**导出模板**
- 详情：基础信息、目录树、路由（前端/全栈）、AntV X6 流程图
- **不做**：pi Agent 部署、用户审批（走主应用菜单）

## 关键路径

| 层 | 路径 |
|----|------|
| 模板契约 | `backend/app/lib/projectTemplate.js` |
| 列表页 | `frontend/src/views/OpsProjectListPage.vue` |
| 详情 + 图 | `frontend/src/components/ops/DetailFlowChart.vue` · `OpsFlowGraph.vue` |
| 样式 | `frontend/src/styles/` · `.cursor/rules/ops-sub-style.mdc` |
