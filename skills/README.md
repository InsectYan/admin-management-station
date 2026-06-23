# Skills 目录

本目录存放 admin-management-station 项目的 Agent Skills。每个 skill 独立成目录，含 `SKILL.md`（执行入口）与 `README.md`（用途说明）。

## 可用 Skills

| Skill | 目录 | 说明 |
|-------|------|------|
| project-developer | [project-developer/](project-developer/) | 基于 `docs-project/` 设计文档驱动混合架构开发 |

后续新增 skill 时，在此表追加一行并在对应目录下创建 `SKILL.md` + `README.md`。

## 与开发规范的关系

- **编码规范**： [`.cursor/rules/`](../.cursor/rules/) — 开发时必须遵循（含 **`app-registry.mdc`** 多应用端口/库名）
- **开发流程**： `skills/{skill-name}/` — 定义如何分析设计、拆分任务、分模块实现

Skill 工作流文档引用 `.cursor/rules/`，不在 skill 中重复编码标准。

## 使用方式

在 Cursor 对话中 @ 引用 skill 入口文件：

```
@skills/project-developer/SKILL.md
请根据 docs-project/私人管理平台主应用设计.md 拆分开发任务
```
