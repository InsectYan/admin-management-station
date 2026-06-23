# admin-management-station

管理后台项目。采用 Electron-Egg + React + Qiankun 微前端 + Egg.js BFF + PostgreSQL 混合架构。

## 开发规范

本项目在开发过程中，**无论由人工还是 AI 辅助完成**，均须遵循 `.cursor` 目录中注明的开发规范。

规范文件位于 [`.cursor/rules/`](.cursor/rules/) 目录，按技术栈拆分：

| 规则 | 说明 |
|-----|------|
| `development-standards.mdc` | 通用开发约束（始终生效） |
| `electron-react.mdc` | Electron + React 前端 |
| `egg-backend.mdc` | Egg.js 后端 |
| `postgresql.mdc` | PostgreSQL 数据库 |
| `qiankun-microfrontend.mdc` | Qiankun 微前端 |
| `react-antd.mdc` | Ant Design 子应用 UI |

## 设计文档

项目设计说明位于 [`docs-project/`](docs-project/) 目录。

## Agent Skills

开发流程 skill 位于 [`skills/`](skills/) 目录。当前可用：

- [project-developer](skills/project-developer/) — 基于设计文档拆分任务并驱动分模块开发

用法见 [skills/project-developer/README.md](skills/project-developer/README.md)。
