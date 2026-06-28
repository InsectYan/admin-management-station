# project-sub — 子应用聚合目录

本目录存放所有接入主应用（Qiankun）的子应用。主应用启动时会扫描此目录，自动注册一级菜单。

## 现有子应用

| 目录 | app_key | CLI | manifest |
|------|---------|-----|----------|
| `novel-sub/` | `novel` | `ams-novel` | `subapp.manifest.json` |
| `testgen-sub/` | `testgen` | `ams-testgen` | `subapp.manifest.json` |

## 新增子应用

1. 复制 `novel-sub/` 整目录到 `project-sub/{name}-sub/`
2. 修改 `subapp.manifest.json`（端口、名称、路由前缀等）
3. 在 [`docs-project/应用端口与命名注册表.md`](../docs-project/应用端口与命名注册表.md) 登记端口
4. 启动主应用或执行 `ams-main sync:subapps`，菜单自动出现

## manifest 契约

每个子应用根目录须提供 `subapp.manifest.json`：

```json
{
  "app_key": "novel",
  "microapp_name": "novel-app",
  "display_name": "小说管理",
  "route_prefix": "novel",
  "entry_dev": "http://localhost:5101",
  "entry_prod": "/subapps/novel-app/",
  "vite_port": 5101,
  "api_port": 5201,
  "menu_order": 1,
  "icon": "icon-novel",
  "entry_env": "SUBAPP_NOVEL_ENTRY"
}
```

扫描规则（与 `agent-management-master` PluginManager 一致）：

- 跳过以 `_` 或 `.` 开头的目录
- 跳过无 `subapp.manifest.json` 的目录
- 启动时全量扫描，已移除的子应用自动禁用菜单

同步脚本：[`menu-master/deploy/scripts/sync-subapps.mjs`](../menu-master/deploy/scripts/sync-subapps.mjs)
