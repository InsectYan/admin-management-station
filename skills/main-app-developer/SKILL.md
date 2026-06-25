---
name: main-app-developer
description: >-
  admin-management-station 主应用（Qiankun 基座）通用开发流程。
  涵盖 Vue 3 前端、Egg.js BFF、PostgreSQL、Docker 自包含部署。
  不含子应用业务域；接入子应用见 sub-app-developer。
  当用户开发 menu-master、主应用菜单、基座布局、Qiankun 注册时使用。
---

# Main App Developer

主应用（`app_key=main`）通用开发流程。**编码规范以 [`.cursor/rules/`](../../.cursor/rules/) 为准。**

## 前置

1. 核对 [`app-registry.mdc`](../../.cursor/rules/app-registry.mdc) 与 [`docs-project/应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md)
2. 应用目录须自包含：见 [`app-self-contained.mdc`](../../.cursor/rules/app-self-contained.mdc)
3. 业务需求来自 `docs-project/` 中主应用设计文档（本 skill 不展开业务细节）

## 工作流文档（按需加载）

| 步骤 | 文档 | 规则 |
|------|------|------|
| 前端基座 | [vue-frontend.md](vue-frontend.md) | `vue-web.mdc` |
| BFF | [egg-backend.md](egg-backend.md) | `egg-backend.mdc` |
| 微前端注册 | [qiankun-base.md](qiankun-base.md) | `qiankun-microfrontend.mdc` |
| 数据库 | [postgresql.md](postgresql.md) | `postgresql.mdc` |
| 部署 | [docker.md](docker.md) | `docker.mdc`、`docker-compose.mdc`、`deploy-cli.mdc` |

## 推荐实现顺序

```
database/init.sql → backend Model/Service/Controller → frontend 布局与菜单
→ qiankun 动态 registerMicroApps → deploy 联调
```

## 验收（技术）

- [ ] `{ code, message, data }` 响应格式一致
- [ ] `GET /api/menus` 未被 JWT 误拦（见 `subapp-onboarding.mdc`）
- [ ] 菜单 API 返回子应用 `entry`、`microapp_name`
- [ ] `ams-main local` 可独立启动
- [ ] 点击菜单可加载已启动的子应用 entry

## 禁止

- 在主应用 rules/skill 中硬编码子应用业务 API
- 硬编码端口（须 env + registry）
- 跳过 `subapp-onboarding.mdc` 直接联调子应用

## 相关 Skill

- 子应用脚手架：[`../sub-app-developer/SKILL.md`](../sub-app-developer/SKILL.md)
- 按项目迭代：[`../project-developer/`](../project-developer/)
