# 子应用前端工作流（React + Ant Design + Vite）

> 编码规范：`.cursor/rules/react-web.mdc`、`.cursor/rules/react-antd.mdc`、`.cursor/rules/app-self-contained.mdc`

## 参考设计

- `docs-project/小说管理页面子应用设计.MD`
- **`docs-project/应用端口与命名注册表.md`**（`app_key=novel`）

## 目录（自包含子应用）

```
novel-sub/
  frontend/src/          # Vite dev :5174
  backend/               # Egg.js :7002
  agent/                 # Pi :7003
  database/              # init.sql
  deploy/                # ams-novel
```

## 小说子应用端口（app_key=novel）

| 用途 | 端口 / 库名 |
|------|-------------|
| Egg.js API | 7002 |
| Pi Agent | 7003 |
| Vite dev | 5174 |
| Postgres 宿主机 | 5433 · `novel_db` |
| Redis 宿主机 | 6380 |

## 实现顺序

1. Vite + React + Ant Design + `vite-plugin-qiankun`
2. 导出 Qiankun 生命周期（bootstrap/mount/unmount）
3. Router `basename` 从 props 获取
4. 多步骤表单草稿 → `sessionStorage` 或后端草稿 API
5. `ams-novel local` 验证完整栈可独立部署

## 验收

- [ ] 独立 `npm run dev` 可访问
- [ ] 嵌入主应用 basename 正确
- [ ] 复制 `novel-sub/` 目录可脱离 monorepo 运行
