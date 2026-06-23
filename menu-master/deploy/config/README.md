# 主应用部署配置（app_key=main）

对齐 [cartoon-agent/deploy/config](E:/AI Tools/projects/cartoon-agent/deploy/config)。

| 文件 | 场景 | 提交 git |
|------|------|---------|
| `.env.local` | 本地 Docker 团队默认 | 是 |
| `Dockerfile` | Egg.js BFF 镜像（build context = menu-master 根） | 是 |

前端镜像在 **`frontend/Dockerfile`**（Vite dev，同 cartoon-agent `frontend/Dockerfile`）。

## 加载顺序（本地）

1. **`menu-master/deploy/config/.env.local`**
2. **`menu-master/backend/.env`**（个人覆盖）
3. **`menu-master/frontend/.env.local`**（Docker 前端代理，见 `.env.local.example`）

## Docker Hub 拉取失败

若出现 `failed to resolve reference ... registry-1.docker.io`（国内网络常见）：

编辑 `config/.env.local`：

```env
POSTGRES_IMAGE=docker.1ms.run/library/postgres:16-alpine
```

或 Docker Desktop → Settings → Docker Engine → 配置 `registry-mirrors`。

## 缓存与子应用 entry

- **缓存**：默认 `CACHE_DRIVER=memory`（进程内，无需 Redis 容器），见 `.cursor/rules/cache-local.mdc`。
- **子应用 entry**：`SUBAPP_NOVEL_ENTRY` 指向 novel-sub Vite（Docker 内默认 `http://host.docker.internal:5174`）。

```bash
cp menu-master/backend/.env.example menu-master/backend/.env
cp menu-master/frontend/.env.local.example menu-master/frontend/.env.local
cd menu-master/deploy && npm link
ams-main local
```
