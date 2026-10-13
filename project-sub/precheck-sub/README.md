# precheck-sub

`app_key=precheck` · 自包含子应用（frontend + backend + database + deploy）

登记本机 ComfyUI v0.39.0，比对工作流缺的节点和模型。ComfyUI 不进本栈，留在宿主机 `:8188`。容器通过 `host.docker.internal:8188` 调用。

## 端口

| 服务 | 端口 |
|------|------|
| Vite dev | 5104 |
| BFF API | 5204 |
| Postgres 宿主机 | 5304 |
| 数据库 | `precheck_db` |

## 快速启动

```bash
cd project-sub/precheck-sub/deploy && npm link && ams-precheck local
```

宿主机热更新：

```bash
ams-precheck local:infra
cd project-sub/precheck-sub/backend && npm install && npm run dev
cd project-sub/precheck-sub/frontend && npm install && npm run dev
```

未 link 时：`node project-sub/precheck-sub/deploy/scripts/run.mjs local`

## 与主应用联调

```bash
cd precheck-sub/frontend && npm run dev
cd menu-master/deploy && ams-main local
```

浏览器访问主应用 → 侧栏「预检」，或直接打开 http://localhost:5104/media/precheck/runtimes

## 命令

| 命令 | 作用 |
|------|------|
| `ams-precheck local` | Postgres + API + 前端 |
| `ams-precheck local:infra` | 仅 Postgres |
| `ams-precheck local:reset` | 清库重建 |
| `ams-precheck local:down` | 停止本栈 |
