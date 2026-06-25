---
name: sub-app-developer
description: >-
  admin-management-station 微前端子应用通用开发流程。
  自包含目录（frontend + backend + database + deploy）、Qiankun 生命周期、
  apiConfig 绝对 URL、接入主应用 checklist。
  不含具体业务模块；业务实现见 project-developer/{app_key}。
  当用户新建子应用、复制 novel-sub 骨架、接入 Qiankun 时使用。
---

# Sub App Developer

子应用**通用**开发流程。**编码规范以 [`.cursor/rules/`](../../.cursor/rules/) 为准。**

## 前置

1. 在 [`app-registry.mdc`](../../.cursor/rules/app-registry.mdc) **登记**新 `app_key`（API / Vite / PG 端口）
2. 复制已登记子应用目录为模板（当前参考：`novel-sub/`）
3. **必读** [`subapp-onboarding.mdc`](../../.cursor/rules/subapp-onboarding.mdc)

## 工作流文档（按需加载）

| 步骤 | 文档 | 规则 |
|------|------|------|
| 接入清单 | [onboarding.md](onboarding.md) | `subapp-onboarding.mdc` |
| 前端 | [vue-frontend.md](vue-frontend.md) | `vue-web.mdc`、`vue-element-plus.mdc` |
| Qiankun 适配 | [qiankun-subapp.md](qiankun-subapp.md) | `qiankun-microfrontend.mdc` |
| BFF | [egg-backend.md](egg-backend.md) | `egg-backend.mdc` |
| 数据库 | [postgresql.md](postgresql.md) | `postgresql.mdc` |
| 部署 | [docker.md](docker.md) | `docker.mdc`、`docker-compose.mdc` |

## 推荐实现顺序

```
登记 registry → 复制骨架 → database/init.sql
→ backend → frontend（含 apiConfig + qiankun 生命周期）
→ 主库 subapp_registry → ams-{app} local → 与 ams-main 联调
```

## 验收（技术）

- [ ] 独立 `npm run dev` 可访问
- [ ] `/api/health` 正常
- [ ] Qiankun 嵌入：请求 **子 BFF 绝对 URL**
- [ ] basename、entry 与 registry 一致
- [ ] 整目录可复制脱离 monorepo 运行

## 业务开发

模块、API、页面清单见 `docs-project/` 对应设计文档 → 使用 [`../project-developer/{app_key}/`](../project-developer/)。

## 相关 Skill

- 主应用：[`../main-app-developer/SKILL.md`](../main-app-developer/SKILL.md)
