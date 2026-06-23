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

## 快速开始

```bash
cp menu-master/backend/.env.example menu-master/backend/.env
cp menu-master/frontend/.env.local.example menu-master/frontend/.env.local
cd menu-master/deploy && npm link
ams-main local
```
