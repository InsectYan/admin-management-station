# sub-app-developer

微前端子应用**通用**脚手架与接入 Skill。

## 何时使用

- 新建 `{app}/` 自包含子应用
- 配置 Qiankun 生命周期、`apiConfig.js`
- 登记端口、compose、`subapp_registry`
- **不**包含具体业务 CRUD 实现

## 引用

```
@skills/sub-app-developer/SKILL.md
```

## 文件

| 文件 | 内容 |
|------|------|
| `onboarding.md` | 接入主应用 checklist |
| `vue-frontend.md` | 子应用前端结构 |
| `qiankun-subapp.md` | 生命周期与 basename |
| `egg-backend.md` | 子 BFF 配置（cors 等） |
| `postgresql.md` | 独立业务库 |
| `docker.md` | `ams-{app_key}` |

业务功能开发请转 [`../project-developer/{app_key}/`](../project-developer/)。
