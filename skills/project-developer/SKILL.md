---
name: project-developer
description: >-
  基于 docs-project/ 设计文档驱动 admin-management-station 混合架构开发。
  分析设计文档、按技术栈拆分任务、检测设计缺陷并指导分模块实现。
  适用于 React Web 主应用、Qiankun 微前端子应用、Egg.js BFF、PostgreSQL、Docker 部署场景。
  当用户提供或引用 docs-project/ 设计文档、要求按设计开发、拆分任务或启动子模块开发时使用。
---

# Project Developer

基于 `docs-project/` 设计文档，按技术栈拆分并驱动 admin-management-station 的开发流程。

## 前置条件

1. 确认目标设计文档路径（默认 `docs-project/` 下对应 `.md` 文件）。
2. 阅读 [README.md](README.md) 了解 skill 用法。
3. 开发编码规范以 [`.cursor/rules/`](../../.cursor/rules/) 为准，本 skill 只定义**流程与实现要点**。
4. **多应用并行**：实现前读取 [应用端口与命名注册表](../../docs-project/应用端口与命名注册表.md)（或 `app-registry.mdc`），确认 `app_key`、API 端口、Vite dev 端口、`POSTGRES_DB` 无冲突。

## 执行流程

### 1. 分析设计文档

读取 [design-doc-workflow.md](design-doc-workflow.md)，从文档中提取：

- 应用类型：主应用 / 子应用
- 模块清单、API 接口、数据库表
- 微前端配置（`microapp_name`、`route_prefix`、`basename`）
- 交互流程与页面清单

输出：**模块清单 + 技术栈映射表**。

### 2. 技术栈拆分

按模块归属分配到以下工作流文档，**每次只加载当前任务相关文档**：

| 技术栈 | 工作流文档 | 编码规范 |
|-------|-----------|---------|
| 主应用前端 | [react-web-main.md](react-web-main.md) | `react-web.mdc` |
| 子应用前端 | [react-web-subapp.md](react-web-subapp.md) | `react-web.mdc` + `react-antd.mdc` |
| Docker 部署 | [docker-workflow.md](docker-workflow.md) | `docker.mdc` + **`docker-compose.mdc`** + `deploy-cli.mdc` |
| Pi Agent | [../docs-project/Agent开发方案.md](../../docs-project/Agent开发方案.md) | `pi-v3-agent.mdc` + `pi-minimal-design.mdc` |
| 微前端集成 | [qiankun-microfrontend.md](qiankun-microfrontend.md) | `qiankun-microfrontend.mdc` |
| 后端 BFF | [egg-backend.md](egg-backend.md) | `egg-backend.mdc` |
| 数据库 | [postgresql.md](postgresql.md) | `postgresql.mdc` |

### 3. 设计缺陷检测

执行 [design-doc-workflow.md](design-doc-workflow.md) 中的检测清单。发现问题时：

- 生成 `error/report.md`（Markdown 表格：类型、描述、位置、建议）
- **暂停实现**，列出缺陷供用户确认
- 用户确认修复设计或同意忽略后再继续

### 4. 任务拆分与目录

根据设计文档生成任务清单，建议结构：

```
tasks/
  {模块名}/
    README.md       # 任务描述、依赖、验收标准
    front-end/      # 前端任务（如有）
    back-end/       # 后端任务（如有）
    database/       # 迁移/SQL（如有）
```

每个任务 README 须注明：对应设计文档章节、依赖任务、引用的 `.cursor/rules/` 文件。

### 5. 分模块开发

对每个任务：

1. 加载对应工作流文档 + `.cursor/rules/` 规范
2. 先数据库/模型 → 后端 API → 前端页面（有依赖时按此顺序）
3. 子应用开发完成后验证 Qiankun 生命周期与 basename
4. 完成后更新任务 README 状态

### 6. 验收

- API 响应格式符合 Egg 规范（`code/message/data`）
- 数据库表含 `created_at`、`updated_at` 与必要索引
- 主应用菜单 ↔ 子应用注册字段一致
- 子应用独立运行与嵌入主应用均正常

## 项目设计文档索引

| 文档 | 类型 | 说明 |
|-----|------|------|
| `docs-project/应用端口与命名注册表.md` | 注册表 | **各应用端口、库名、容器名（并行开发必读）** |
| `docs-project/私人管理平台主应用设计.md` | 主应用 | React Web + Qiankun 基座、菜单系统 |
| `docs-project/小说管理页面子应用设计.MD` | 子应用 | React + Ant Design 小说管理微应用 |
| `docs-project/部署与Docker方案.md` | 部署 | Docker Compose 与 Nginx 拓扑 |

## 禁止事项

- 不将多个技术栈规范混写在同一实现文件中
- 不跳过设计缺陷检测直接编码
- 不在渲染进程直接使用 Node.js API（本项目为 Web SPA，无桌面进程）
- 不偏离设计文档自行扩展未要求的功能
- 不硬编码端口或数据库名；须符合 `app-registry.mdc` 登记值
