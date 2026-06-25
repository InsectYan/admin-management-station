---
name: novel-sub-developer
description: >-
  在 novel-sub（app_key=novel）上按设计文档迭代开发。
  解析 docs-project/小说管理页面子应用设计.MD，拆分任务、检测设计缺陷、
  实现小说/章节等业务模块。通用子应用脚手架见 sub-app-developer。
  当用户在 novel-sub 目录开发、引用小说子应用设计文档时使用。
---

# Novel Sub — Project Developer

在 **`novel-sub/`** 上按设计文档驱动业务开发。通用技术流程先读 [`../../sub-app-developer/SKILL.md`](../../sub-app-developer/SKILL.md)。

## 应用标识

| 项 | 值 |
|----|-----|
| `app_key` | `novel` |
| 根目录 | `novel-sub/` |
| CLI | `ams-novel` |
| 设计文档 | [`docs-project/小说管理页面子应用设计.MD`](../../docs-project/小说管理页面子应用设计.MD) |
| 端口 | [`docs-project/应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md) |

## 执行流程

### 1. 分析设计文档

读取 [design-doc-workflow.md](design-doc-workflow.md)：

- 提取页面、API、数据表、路由
- 输出模块清单 + 技术栈映射
- 执行缺陷检测 → 有问题写 `error/report.md` 并暂停

### 2. 加载规范

| 层 | 通用 Skill | 规则 |
|----|-----------|------|
| 前端 | `sub-app-developer/vue-frontend.md` | `vue-web.mdc`、`vue-element-plus.mdc` |
| BFF | `sub-app-developer/egg-backend.md` | `egg-backend.mdc` |
| DB | `sub-app-developer/postgresql.md` | `postgresql.mdc` |
| 接入 | `sub-app-developer/onboarding.md` | `subapp-onboarding.mdc` |
| 部署 | `sub-app-developer/docker.md` | `docker-compose.mdc` |

### 3. 实现顺序

```
database → backend API → frontend views → Qiankun 联调
```

### 4. 任务目录（可选）

```
tasks/{模块}/
  README.md      # 设计文档章节、验收、依赖
  front-end/
  back-end/
  database/
```

## 模块索引（设计文档章节）

详见 [modules.md](modules.md)。

## 验收

- [ ] API 与设计文档端点一致
- [ ] 表结构含 `created_at`、`updated_at`
- [ ] 独立运行与嵌入主应用均正常
- [ ] 不偏离设计文档擅自扩展功能

## 禁止

- 在 novel-sub 重复实现通用 Qiankun 说明（用 sub-app-developer）
- 硬编码端口
- 跳过设计缺陷检测直接编码
