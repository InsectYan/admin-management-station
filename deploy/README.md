# 已废弃 — 共享 infra

原 `deploy/compose/infra.yml`（全仓共享 Postgres/Redis）**已废弃**，与 [`app-self-contained.mdc`](../.cursor/rules/app-self-contained.mdc) 冲突。

## 请改用各应用自管 infra

| 应用 | Postgres 容器 | 本地 CLI（需 Node） | Compose 目录 |
|------|---------------|---------------------|--------------|
| 主应用 | `ams-main-postgres` | `ams-main local` | [`menu-master/deploy/`](../menu-master/deploy/) |
| 小说 | `ams-novel-postgres` | `ams-novel local` | [`project-sub/novel-sub/deploy/`](../project-sub/novel-sub/deploy/) |
| AI 测试 | `ams-testgen-postgres` | `ams-testgen local` | [`project-sub/testgen-sub/deploy/`](../project-sub/testgen-sub/deploy/) |
| 运维 | `ams-ops-postgres` | `ams-ops local` | [`project-sub/ops-sub/deploy/`](../project-sub/ops-sub/deploy/) |

`compose/infra.yml` 仅作历史参考，**新代码不得 include**。

---

## ECS / 无 npm 环境：直接用 Docker Compose

机器只需 **Docker + Compose 插件**，不必安装 Node / npm，也不必 `npm link` 或跑 `ams-*`。

假设仓库根在 ECS 上为 `/opt/project/admin-management-station`（按实际路径替换）。

### 运维 GitHub 部署：同级镜像仓（可选）

ECS 上 GitHub 部署可改为「与 AMS 同级 git 仓增量更新」，避免每次在容器内整段重下：

```bash
# ops-sub/deploy/config/.env.local
OPS_GIT_MIRROR_ENABLED=1
OPS_GIT_MIRROR_MOUNT=/opt/project          # 与 admin-management-station 同级根
OPS_GIT_MIRROR_ROOT=/host-mirrors         # 容器内挂载点（compose 已配）
```

效果：仓库 `…/fitness-agent.git` → 宿主机 `/opt/project/fitness-agent`（无则 clone，有则 fetch），再按 `同级/项目名/包路径` 取文件。  
**本地 `code_source=local` / 本机开发不受影响**（保持 `OPS_GIT_MIRROR_ENABLED=0`）。

### 运维 GitHub 部署：HTTPS / SSH

部署页可切换 **HTTPS** 或 **SSH**（选哪个用哪个；保存后会规范化 `repo_url`）。

| 协议 | clone/fetch | 自动打 tag / 列标签 / 非镜像下包 |
|------|-------------|----------------------------------|
| HTTPS | PAT（个人信息） | PAT |
| SSH | 容器内部署密钥 | 仍需 PAT |

SSH 密钥挂载（ECS 示例）：

```bash
# 宿主机
mkdir -p /opt/project/.ops-git-ssh
# 放入私钥 id_ed25519（权限 600），公钥加到仓库 Deploy keys 或账号 SSH keys

# ops-sub/deploy/config/.env.local
OPS_GIT_SSH_MOUNT=/opt/project/.ops-git-ssh
OPS_GIT_SSH_DIR=/ops-git-ssh
# known_hosts 默认用镜像内置 GitHub 官方指纹
```

改完后需 `docker compose ... up -d --build` 重建 api-ops（镜像需含 `openssh-client`）。

### 0. 启动前必做文件（否则 compose 报 env file not found）

主应用 `docker-compose.yml` 的 `env_file` **强制引用**下列路径；文件不存在会直接失败（你看到的  
`backend/.env not found` 即此原因）。**不改 compose**，在 ECS 上补齐即可：

```bash
REPO=/opt/project/admin-management-station

# 主应用：个人密钥文件（gitignore，须从 example 复制）
cp -n "$REPO/menu-master/backend/.env.example" "$REPO/menu-master/backend/.env"
cp -n "$REPO/menu-master/frontend/.env.local.example" "$REPO/menu-master/frontend/.env.local"

# 各应用 deploy 配置（仓库内一般已有；没有则对照同目录文档补）
#   menu-master/deploy/config/.env.local
#   project-sub/*/deploy/config/.env.local
ls "$REPO/menu-master/deploy/config/.env.local"
```

子应用 compose **只**依赖各自 `deploy/config/.env.local`，一般无需再建 `backend/.env`。

### 1. 启动命令（等同 `ams-* local`）

```bash
REPO=/opt/project/admin-management-station

# 主应用 → 前端 :5100 / API :5200 / PG :5300
cd "$REPO/menu-master/deploy"
docker compose -f docker-compose.yml --env-file config/.env.local up -d --build

# 小说 → :5101 / :5201 / :5301
cd "$REPO/project-sub/novel-sub/deploy"
docker compose -f docker-compose.yml --env-file config/.env.local up -d --build

# 测试 → :5102 / :5202 / :5302
cd "$REPO/project-sub/testgen-sub/deploy"
docker compose -f docker-compose.yml --env-file config/.env.local up -d --build

# 运维 → :5103 / :5203 / :5303
cd "$REPO/project-sub/ops-sub/deploy"
POSTGRES_IMAGE=postgres:16-alpine \
  docker compose -f docker-compose.yml --env-file config/.env.local up -d --build
```

仅起数据库（等同 `local:infra`）：在对应 `deploy/` 下把末尾改成 `up -d postgres`。

停止 / 清库：

```bash
# 在对应 deploy/ 目录
docker compose -f docker-compose.yml --env-file config/.env.local down      # 停栈
docker compose -f docker-compose.yml --env-file config/.env.local down -v   # 停栈并删卷（清库）
```

或用仓库自带脚本（仍不需要 npm）：

```bash
cd "$REPO/project-sub/ops-sub/deploy"
POSTGRES_IMAGE=postgres:16-alpine bash scripts/compose.sh up -d --build
```

### 2. 验收

```bash
curl -s http://127.0.0.1:5200/api/health
curl -s http://127.0.0.1:5201/api/health
curl -s http://127.0.0.1:5202/api/health
curl -s http://127.0.0.1:5203/api/health
docker ps --filter name=ams-
```

### 3. 镜像拉取失败（`docker.1ms.run/... not found`）

`menu-master` / `ops-sub` 的 `deploy/config/.env.local` 里可能有：

```bash
POSTGRES_IMAGE=docker.1ms.run/library/postgres:16-alpine
```

该加速源若失效，会报 `failed to resolve reference ... not found`。**不必改仓库里的 compose**，在 ECS 上任选其一：

**A. 单次启动覆盖（推荐先试）**

```bash
cd "$REPO/menu-master/deploy"
POSTGRES_IMAGE=postgres:16-alpine \
  docker compose -f docker-compose.yml --env-file config/.env.local up -d --build
```

运维同理：

```bash
cd "$REPO/project-sub/ops-sub/deploy"
POSTGRES_IMAGE=postgres:16-alpine \
  docker compose -f docker-compose.yml --env-file config/.env.local up -d --build
```

**B. 只改 ECS 上的 env（不提交 git）**

编辑服务器上的 `deploy/config/.env.local`，注释或改成：

```bash
# POSTGRES_IMAGE=docker.1ms.run/library/postgres:16-alpine
POSTGRES_IMAGE=postgres:16-alpine
```

**C. ECS 仍拉不动 Docker Hub**

在宿主机配置 Docker 镜像加速（`/etc/docker/daemon.json` 的 `registry-mirrors`），镜像名仍用官方 `postgres:16-alpine`，不要写死已失效的 `docker.1ms.run` 路径。

可先探测：

```bash
docker pull postgres:16-alpine
```

### 4. 运维平台：`invalid volume specification: 'E:/AI Tools/...'`

**已修复（代码默认）**：`ops-sub/deploy` 的 `HOST_PROJECTS_MOUNT` / `OPS_DEPLOY_WORKDIR_HOST` 改为相对 `deploy/` 的路径（挂 monorepo 根与 `.ops-deploy-work`），**不要再把 `E:/...` 写进可提交的 `.env.local`**。

ECS 上更新代码后直接：

```bash
cd "$REPO/project-sub/ops-sub/deploy"
POSTGRES_IMAGE=postgres:16-alpine \
  docker compose -f docker-compose.yml --env-file config/.env.local up -d --build
```

Windows 本机若要挂盘符下更多目录（如整个 `E:/AI Tools/projects`），仅在本机 `.env.local` 覆盖：

```bash
HOST_PROJECTS_MOUNT=E:/AI Tools/projects
```

若 ECS 上仍报 `E:/...`，说明服务器还是旧 `.env.local`，打开 `config/.env.local` 删掉 Windows 绝对路径，或拉最新后再 up。

部署时 `source_path` 须落在挂载进 `/host-projects` 的目录下（默认即 monorepo 内路径）。

### 5. 如何访问（浏览器）

主应用入口是 **Vite 前端端口 5100**（不是 5200）：

```text
http://<ECS公网IP>:5100
```

| 端 | 端口 | 用途 |
|----|------|------|
| 主应用前端 | **5100** | 浏览器打开这个 |
| 主应用 API | 5200 | 一般经前端代理；可测 `http://<IP>:5200/api/health` |
| 小说 / 测试 / 运维前端 | 5101 / 5102 / 5103 | Qiankun 由**浏览器**拉取，须可从你电脑访问 |

**安全组 / 防火墙**：至少放行 TCP `5100`；要点子菜单还须放行 `5101–5103`（以及可选 `5200–5203`）。

**本机自检（在 ECS 上）**：

```bash
curl -sI http://127.0.0.1:5100 | head -3
curl -s http://127.0.0.1:5200/api/health
```

**侧栏没有「运维管理平台」**：只起 ops 容器**不会**写主库菜单。须执行 `ams-main sync:subapps`（或手工 SQL），见下节 §5.1。

**公网打开主站后的常见问题**（`http://<公网IP>:5100`）：

| 现象 | 原因 | 处理 |
|------|------|------|
| `GET /api/media/profiles` 很慢 → 502 | 主 BFF 转发 Agent `:4001`，ECS 未起 Agent 会超时 | 可不启 Agent；侧栏多模态暂不可用。要用则起 Agent 并设 `AGENT_PLATFORM_URL` |
| 子应用拉 `localhost:510x` | **已在前端代码修复**：`rewriteLoopbackHost` 会把 entry/API 的 localhost 换成当前访问的 hostname | 拉取最新代码后重启 `ams-main-frontend` 与子应用 frontend 容器即可，**不必**再手写公网 IP 进库 |
| 刷新注册失败 | 旧前端未含上述改写 | 更新代码并 `docker restart ams-main-frontend ams-ops-frontend`（等） |

安全组仍须放行子应用端口（浏览器直连）：`5101–5103`、`5201–5203`（按实际启用的子应用）。

本地开发访问 `http://localhost:5100` 时 hostname 仍是 localhost，行为与改前一致。

**子应用菜单打不开时（旧镜像）**：若尚未更新前端，可临时把 entry 改成公网；优先以代码自动改写为准。

### 5.1 子应用菜单如何注册（为何起了 ops 却看不见）

| 步骤 | 谁做 | 说明 |
|------|------|------|
| 1 | `project-sub/*/subapp.manifest.json` | 声明 `microapp_name`、`display_name`、`route_prefix`、`entry_dev` 等 |
| 2 | `sync-subapps.mjs` | 扫描 manifest → 写入主库 `subapp_registry` + 一级 `menu_items`（`status=enabled`） |
| 3 | 主应用 `GET /api/menus/root` | 只返回 `parent_id IS NULL AND status=enabled` 的菜单，再带上 entry 给 Qiankun |

**会自动跑 sync 的情况**：本机执行 `ams-main local` / `ams-main sync:subapps`（需要 Node + `menu-master/backend/node_modules`）。

**不会写菜单的情况**：ECS 上只用 `docker compose up` 起主应用或运维栈 —— **compose 不会跑 sync**。旧库 migration 里可能只有 novel / testgen 种子，**没有 ops**。

ECS 无 Node 时，可在主库 Postgres 手工登记（容器名按实际改）：

```bash
docker exec -i ams-main-postgres psql -U admin -d admin_platform <<'SQL'
INSERT INTO subapp_registry (
  microapp_name, app_key, display_name, entry_dev, entry_prod,
  vite_port, api_port, status, updated_at
) VALUES (
  'ops-app', 'ops', '运维管理平台', 'http://localhost:5103', '/subapps/ops-app/',
  5103, 5203, 'enabled', NOW()
)
ON CONFLICT (microapp_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  entry_dev = EXCLUDED.entry_dev,
  status = 'enabled',
  updated_at = NOW();

INSERT INTO menu_items (name, parent_id, route_prefix, microapp_name, status, "order", icon, updated_at)
SELECT '运维管理平台', NULL, 'ops', 'ops-app', 'enabled', 3, 'icon-ops', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE microapp_name = 'ops-app' AND parent_id IS NULL
);

UPDATE menu_items SET status = 'enabled', name = '运维管理平台', route_prefix = 'ops', "order" = 3
WHERE microapp_name = 'ops-app' AND parent_id IS NULL;
SQL
```

然后**重启主应用 API**（或等菜单缓存过期，默认约 300s）再刷新浏览器：

```bash
docker restart ams-api-main
```

有 Node 的机器也可连 ECS 的 `MAIN_POSTGRES_PORT`（默认 5300）跑：`ams-main sync:subapps`。

### 6. 说明

| 项 | 说明 |
|----|------|
| 路径 | Windows 本机目录与 ECS 上 `/opt/project/...` 无关；**在 ECS 上 cd 到服务器里的 `deploy/` 再执行** |
| `ams-main sync:subapps` | 依赖 Node；ECS 无 Node 时先起子应用栈，菜单同步用 §5.1 手工 SQL 或有 Node 的环境执行 |
| `db` / `db:seed` | 同样依赖 Node；日常 `up -d --build` 不需要 |
| 旧版 Compose | 若只有 `docker-compose`（带横杠），把命令里的 `docker compose` 换成 `docker-compose` |
