# main-app-developer

主应用（Qiankun 基座）**通用**开发 Skill，不含业务域模块说明。

## 何时使用

- 开发/维护 `menu-master/`（或新的 `app_key=main` 应用）
- 菜单系统、JWT、Qiankun 基座、主库 `subapp_registry`
- Docker `ams-main` 栈

## 引用

```
@skills/main-app-developer/SKILL.md
```

## 文件

| 文件 | 内容 |
|------|------|
| `SKILL.md` | 执行入口 |
| `vue-frontend.md` | 基座前端流程 |
| `egg-backend.md` | 主 BFF 分层与配置 |
| `qiankun-base.md` | 动态注册子应用 |
| `postgresql.md` | DDL / ORM 通用流程 |
| `docker.md` | compose 与 CLI |

业务 API、表结构以 `docs-project/私人管理平台主应用设计.md` 为准；实现时 @ 该文档或 [`../project-developer/`](../project-developer/) 下对应 skill（若后续新增 `main` 项目 skill）。
