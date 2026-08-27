# novel-sub — 小说创作平台

`app_key=novel` · 自包含子应用（frontend + backend + database + deploy）

## 端口

| 服务 | 端口 |
|------|------|
| Vite dev | 5101 |
| BFF API | 5201 |
| Postgres 宿主机 | 5301 |
| 数据库 | `novel_db` |

## 快速启动

```bash
cd novel-sub/deploy && npm link && ams-novel local
```

宿主机热更新：

```bash
ams-novel local:infra
cd novel-sub/backend && cp .env.example .env && npm install && npm run dev
cd novel-sub/frontend && npm install && npm run dev
```

## 与主应用联调

```bash
cd novel-sub/frontend && npm run dev          # :5101
cd menu-master/deploy && ams-main local       # 自动 sync-subapps
```

浏览器访问主应用 → 侧栏「小说创作平台」

## 前端路由

| 路径 | 说明 |
|------|------|
| `/novels` | 小说列表（看板 / 表格） |
| `/novels/create` | 五步创作向导（新建） |
| `/novels/create?id={id}&step={1-5}` | 继续编辑草稿 |
| `/novels/:id?tab={1-5}` | 小说详情（五模块只读） |

架构与 API 详见 [`docs/架构关系图.md`](docs/架构关系图.md)

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/novels` | 创建草稿 |
| PUT | `/api/novels/:id` | 更新基础信息 |
| PUT | `/api/novels/:id/setting` | 保存世界观/人物/大纲/章节 |
| GET | `/api/novels/:id` | 加载草稿（含 setting_json） |

## 联调验收（创建页）

- [ ] 独立 dev `:5101`：列表 → 新建 → 五步流程 → 完成回列表
- [ ] 嵌入主应用 `:5100`：无样式泄漏、内容区单滚动条
- [ ] 步骤 3：添加角色与关系边，保存后刷新回显
- [ ] 步骤 5：拖拽章节排序，保存后顺序保持
- [ ] `?id=` 刷新后数据回显；加载失败可重试
- [ ] 未保存离开有确认提示

## 二期能力

| 能力 | 说明 |
|------|------|
| 人物关系图 | AntV G6，`setting_json.character_edges` |
| 章节拖拽 | Sortablejs 手柄排序 |
| 主应用 subapp 路由 | `menu-master` Vite 代理 `/subapps/novel-app/` |

## 常见问题

| 现象 | 处理 |
|------|------|
| `Failed to resolve import "xxx"` | 修改 `package.json` 后须重建前端镜像 |
| `无法连接服务器` | 确认 `cd novel-sub/backend && npm run dev` 已启动（:5201） |
| PostCSS / JSON `Unexpected token ''` | 源文件含 UTF-8 BOM；勿用 `Set-Content -Encoding UTF8` 写 JSON/JS |
| `ams-novel db:init` | 初始化 schema（须先 `ams-novel local:infra`） |

## 开发规范

见仓库根 [`.cursor/rules/subapp-development.mdc`](../../.cursor/rules/subapp-development.mdc)

变更登记：[`docs/变更记录.md`](docs/变更记录.md)

创建页计划：[`docs/待办-小说创建页开发计划.md`](docs/待办-小说创建页开发计划.md)
