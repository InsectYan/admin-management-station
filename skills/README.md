# Skills 目录

admin-management-station 开发流程 Skills。编码规范见 [`.cursor/rules/`](../.cursor/rules/)，Skills 只定义**流程与加载顺序**，不重复 rules 条文。

## 结构

```
skills/
├── main-app-developer/       # 主应用（基座）通用开发
├── sub-app-developer/        # 子应用脚手架与 Qiankun 接入（通用）
└── project-developer/        # 按已登记应用扩展（含业务设计文档）
    └── testgen-sub/            # 示例：在 testgen-sub 上迭代
```

## 选用指南

| 场景 | @ 引用 |
|------|--------|
| 新建/维护主应用基座 | `@skills/main-app-developer/SKILL.md` |
| 新建子应用或接入 Qiankun | `@skills/sub-app-developer/SKILL.md` |
| 在已有子应用上按设计文档开发 | `@skills/project-developer/{app_key}/SKILL.md` |
| 执行期配置 AI 自动补齐（分阶段双轮） | `@skills/project-developer/testgen-sub/execution-config-autofill/SKILL.md` 或仓库根 `@开发SKILL.MD` |

## 与 docs-project 的关系

- **rules + main/sub skills**：纯技术栈，不含业务域说明。
- **project-developer/{app}/**：引用 `docs-project/` 中对应设计文档，负责模块拆分与缺陷检测。
- 设计文档本身不在 skills 中重复；无设计说明的章节不做额外优化。

## 使用示例

```
@skills/main-app-developer/SKILL.md
实现菜单 API 与 Qiankun 动态注册

@skills/sub-app-developer/SKILL.md
复制 testgen-sub 骨架登记新 app_key

@skills/project-developer/testgen-sub/SKILL.md
根据 docs-project 设计文档实现测试平台功能
```
