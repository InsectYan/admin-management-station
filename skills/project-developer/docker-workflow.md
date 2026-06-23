# Docker 部署工作流

> 编码规范：`.cursor/rules/docker.mdc`、`.cursor/rules/deploy-cli.mdc`

## 参考

- `docs-project/部署与Docker方案.md`
- [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)

## 执行步骤

1. 维护 **`deploy/docker-compose.yml`**（非根目录）
2. 注册 **`ams`** 命令（`deploy/scripts/run.mjs`）
3. 配置 `deploy/config/.env.local` + `apps/*/.env`
4. 验证：`cd deploy && npm link && ams local`

## 命令

| 命令 | 用途 |
|------|------|
| `ams local` | 全栈 |
| `ams local:infra` | 仅 DB + Redis |
| `ams local:down` | 停止 |

## 验收

- [ ] Windows 下 `ams local` 可用（PowerShell）
- [ ] Agent 容器挂载 workspaces/data/template
- [ ] 文档与 `deploy/README.md` 端口一致
