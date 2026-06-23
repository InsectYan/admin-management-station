# 小说子应用（app_key=novel）

业务代码待实现在 `apps/novel-backend`、`apps/novel-frontend`。

**部署与 CLI**：[deploy/README.md](./deploy/README.md)

```bash
cd apps/novel/deploy && npm link
ams-novel local
```

## Pi 工作区（可选，实现 Agent 时）

若小说域接入 Pi Agent，在本目录（或 `apps/novel-*` 包内）按需添加：

- `workspace-templates/` — SOUL.md、AGENTS.md、tools/
- `workspaces/`、`data/` — 运行时（gitignore）

不在仓库根目录配置。详见 [Agent开发方案.md](../../docs-project/Agent开发方案.md) §3。
