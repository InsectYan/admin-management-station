# CLI 命令（主应用）

| 命令 | 作用 |
|------|------|
| `ams-main local` | 启动 Postgres → 同步子应用 → API + 前端 |
| `ams-main sync:subapps` | 扫描 `project-sub/` 同步菜单到主库 |
| `ams-main local:frontend` | 仅重建前端容器 |
| `ams-main local:infra` | 仅 DB |
| `ams-main local:reset` | 清库重建 |
| `ams-main local:down` | 停止本栈 |

## sync-subapps.mjs

启动时扫描 `../../project-sub/`（可用 `PROJECT_SUB_DIR` 覆盖），读取各子应用 `subapp.manifest.json`，同步 `subapp_registry` 与一级 `menu_items`；已移除的子应用自动 `status=disabled`（参考 agent-management-master PluginManager 扫描模式）。

Windows `.ps1` 须 UTF-8 BOM，见 [windows-console.mdc](../../../.cursor/rules/windows-console.mdc)。
