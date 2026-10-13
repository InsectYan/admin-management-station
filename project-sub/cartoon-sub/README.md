# cartoon-sub

`app_key=cartoon` · 自包含子应用（frontend + backend + database + deploy）

项目、章节快照、分镜，以及先预检再出图、出视频。ComfyUI 不进本栈。容器内预检地址是 `host.docker.internal:5204`，出图地址是 `host.docker.internal:8188`。产物卷是 `cartoon_outputs`。

## 端口

| 服务 | 端口 |
|------|------|
| Vite dev | 5105 |
| BFF API | 5205 |
| Postgres 宿主机 | 5305 |
| 数据库 | `cartoon_db` |

## 快速启动

```bash
cd project-sub/cartoon-sub/deploy && npm link && ams-cartoon local
```

宿主机热更新：

```bash
ams-cartoon local:infra
cd project-sub/cartoon-sub/backend && npm install && npm run dev
cd project-sub/cartoon-sub/frontend && npm install && npm run dev
```

未 link 时：`node project-sub/cartoon-sub/deploy/scripts/run.mjs local`

## 与主应用联调

```bash
cd cartoon-sub/frontend && npm run dev
cd menu-master/deploy && ams-main local
```

浏览器访问主应用 → 侧栏「漫剧」，或直接打开 http://localhost:5105/media/cartoon/projects

## 命令

| 命令 | 作用 |
|------|------|
| `ams-cartoon local` | Postgres + API + 前端 |
| `ams-cartoon local:infra` | 仅 Postgres |
| `ams-cartoon local:reset` | 清库重建 |
| `ams-cartoon local:down` | 停止本栈 |
