# 部署配置（local / prod）

团队共享环境变量，**可提交 git**（密钥占位 `CHANGE_ME` 或放 `apps/*/.env`）。

## 文件

| 文件 | 场景 | 提交 git |
|------|------|---------|
| `.env.local` | 本地 Docker | 是 |
| `Dockerfile.agent` | Agent Server 镜像 | 是 |
| `.env.prod` | 生产（待增） | 是 |

个人密钥写在 **`apps/agent-server/.env`**、**`apps/main-backend/.env`** 等，**优先级高于**本目录。

## 加载顺序（本地）

1. `deploy/config/.env.local`
2. `apps/<service>/.env`（个人覆盖）

`deploy/docker-compose.yml` 通过 `env_file` 合并。

## 快速开始

```bash
cd deploy && npm link
ams local
```

仅基础设施（宿主机热更新业务代码）：

```bash
ams local:infra
```
