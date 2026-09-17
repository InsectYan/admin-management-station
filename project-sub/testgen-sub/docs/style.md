# 测试平台清新森林风 — 可行样式规范

视觉与小说平台一致：叶绿为主、半透明表面、分页面景观勾勒。令牌挂在 `.testgen-sub-root`，类名前缀 `testgen-*`。

对照真源：`novel-sub/docs/style.md`。文件：`frontend/src/styles/variables.css`、`element-override.css`、`landscapes.css`。

| 页面域 | 路由前缀 | 景观 |
|--------|----------|------|
| 项目管理 | `/projects` | `testgen-scene--meadow` |
| 用例生成 / 配置 | `/testgen` `/jobs` `/config` | `testgen-scene--grove` |
| 仪表盘 / 洞察 / 专题 | `/fitness/dashboard` `/fitness/insights` `/fitness/topics` | `testgen-scene--lake` |
| 其余 Fitness | `/fitness/*` | `testgen-scene--grove` |

禁止侧栏再写 Element 默认蓝 `#409eff`。语义态 warning/danger 仍用琥珀/红。
