# project-sub — 子应用聚合目录

本目录存放所有接入主应用（Qiankun）的子应用。主应用启动时会扫描此目录，自动注册一级菜单。

## 现有子应用

| 目录 | app_key | CLI | manifest |
|------|---------|-----|----------|
| `novel-sub/` | `novel` | `ams-novel` | `subapp.manifest.json` |
| `testgen-sub/` | `testgen` | `ams-testgen` | `subapp.manifest.json` |

## 新增子应用

1. 复制 `testgen-sub/` 整目录到 `project-sub/{name}-sub/`
2. 修改 `subapp.manifest.json`（端口、名称、路由前缀等）
3. 在 [`docs-project/应用端口与命名注册表.md`](../docs-project/应用端口与命名注册表.md) 登记端口
4. 启动主应用或执行 `ams-main sync:subapps`，菜单自动出现

## manifest 契约

每个子应用根目录须提供 `subapp.manifest.json`：

```json
{
  "app_key": "testgen",
  "microapp_name": "testgen-app",
  "display_name": "AI智能测试平台",
  "route_prefix": "testgen",
  "entry_dev": "http://localhost:5102",
  "entry_prod": "/subapps/testgen-app/",
  "vite_port": 5102,
  "api_port": 5202,
  "menu_order": 2,
  "icon": "icon-testgen",
  "entry_env": "SUBAPP_TESTGEN_ENTRY"
}
```

扫描规则（与 `agent-management-master` PluginManager 一致）：

- 跳过以 `_` 或 `.` 开头的目录
- 跳过无 `subapp.manifest.json` 的目录
- 启动时全量扫描，已移除的子应用自动禁用菜单

同步脚本：[`menu-master/deploy/scripts/sync-subapps.mjs`](../menu-master/deploy/scripts/sync-subapps.mjs)

## 子应用迭代开发规范

在已有子应用上开发（改表、新 Skill、新页面等）须遵守：

| 规则 | 路径 |
|------|------|
| **子应用开发规范** | [`.cursor/rules/subapp-development.mdc`](../.cursor/rules/subapp-development.mdc) |
| **Agent / Skill 开发** | [`.cursor/rules/agent-skill-development.mdc`](../.cursor/rules/agent-skill-development.mdc) |
| Qiankun 接入 | [`subapp-onboarding.mdc`](../.cursor/rules/subapp-onboarding.mdc) |
| DB Schema 同步 | [`database-schema-sync.mdc`](../.cursor/rules/database-schema-sync.mdc) |

要点：

1. **变更登记** — DB / Skill / API / UI 变更写入 `docs/待办-开发节点追踪.md` 或 `docs/变更记录.md`
2. **DB 联动** — 改表须同步 seed、`db:seed` / `db:reset` 等 CLI（参考 `testgen-sub`）
3. **docs 同步** — 更新 `docs/架构关系图.md`、`docs/项目评分与后续计划.md`；缺失则创建
4. **新 Skill** — 无明确提示时默认在 `agent-management-master/plugins/` 开发，遵循 `agent-management-master` 规范

各子应用 README 的「开发规范」节为开发者入口。
