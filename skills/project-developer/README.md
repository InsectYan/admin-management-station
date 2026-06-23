# project-developer

基于 `docs-project/` 设计文档，驱动 admin-management-station 的 Web + Docker 架构开发。

## 用途

- 解析设计文档，提取模块、API、数据库、微前端配置
- 按技术栈拆分开发任务，生成 `tasks/` 任务目录
- 检测设计文档缺陷并输出报告
- 指导 AI 或开发者按规范分模块实现

## 何时使用

- 用户提供或引用 `docs-project/` 下的设计文档
- 要求「按设计文档开发」「拆分任务」「开始主应用/子应用开发」
- 需要对照设计实现菜单系统、微前端集成、后端 API 或数据库

## 用法

### 方式一：在 Cursor 中引用 skill

在对话中说明设计文档路径并 @ 引用本 skill：

```
@skills/project-developer/SKILL.md
请根据 docs-project/私人管理平台主应用设计.md 拆分任务并开始菜单模块开发
```

### 方式二：分步骤触发

1. **仅分析**：「分析 docs-project/小说管理页面子应用设计.MD，输出模块清单与缺陷报告」
2. **仅拆分**：「根据主应用设计文档生成 tasks/ 目录结构」
3. **按栈开发**：「按 egg-backend 工作流实现菜单 API」

### 文件结构

```
skills/project-developer/
├── SKILL.md                    # 执行入口（Agent 读取此文件）
├── README.md                   # 本说明
├── design-doc-workflow.md      # 设计文档分析与缺陷检测
├── react-web-main.md           # 主应用前端工作流
├── react-web-subapp.md         # 子应用前端工作流
├── docker-workflow.md          # Docker 部署工作流
├── qiankun-microfrontend.md    # 微前端集成工作流
├── egg-backend.md              # 后端工作流
└── postgresql.md               # 数据库工作流
```

### 编码规范

**不在本 skill 中重复编码规范。** 开发时须遵循 [`.cursor/rules/`](../../.cursor/rules/) 下对应规则：

- 通用：`development-standards.mdc`
- 前端：`react-web.mdc`、`react-antd.mdc`
- 部署：`docker.mdc`
- 后端：`egg-backend.mdc`
- 数据库：`postgresql.mdc`
- 微前端：`qiankun-microfrontend.mdc`

## 输出物

| 阶段 | 产出 |
|-----|------|
| 分析 | 模块清单、技术栈映射、缺陷报告（如有） |
| 拆分 | `tasks/{模块}/README.md` 及子目录 |
| 开发 | 对应源码、迁移脚本、配置 |
| 缺陷 | `error/report.md` |

## 相关设计文档

- [私人管理平台主应用设计](../../docs-project/私人管理平台主应用设计.md)
- [小说管理页面子应用设计](../../docs-project/小说管理页面子应用设计.MD)
- [部署与Docker方案](../../docs-project/部署与Docker方案.md)
