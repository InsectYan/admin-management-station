# project-developer

在**已登记、已有骨架**的应用上，按 `docs-project/` 设计文档进行业务模块开发。

## 与 main/sub skill 的分工

| 层级 | Skill | 内容 |
|------|-------|------|
| 技术脚手架 | `main-app-developer` / `sub-app-developer` | 端口、Qiankun、compose、分层 |
| 业务迭代 | `project-developer/{app_key}/` | 设计文档分析、模块/API/表、任务拆分 |

## 已登记项目 Skill

| app_key | 目录 | 应用根目录 | 设计文档 |
|---------|------|-----------|----------|
| `novel` | [novel-sub/](novel-sub/) | `novel-sub/` | `docs-project/小说管理页面子应用设计.MD` |
| `testgen` | [testgen-sub/](testgen-sub/) | `testgen-sub/` | `agent-management-sub/design-docs/testgen/README.md` |
| `main` | （待增） | `menu-master/` | `docs-project/私人管理平台主应用设计.md` |

新增子应用业务 skill：复制 `novel-sub/` 为模板，改 `app_key`、设计文档路径、端口表。

## 使用

```
@skills/project-developer/novel-sub/SKILL.md
根据设计文档实现小说列表 API 与页面
```

## 新增 project skill 模板

```
project-developer/{app_key}/
  SKILL.md
  README.md
  design-doc-workflow.md
  modules.md               # 可选：模块与章节映射
```
