# 子应用前端工作流（React + Ant Design + Vite）

> 编码规范：`.cursor/rules/react-web.mdc`、`.cursor/rules/react-antd.mdc`、`.cursor/rules/docker.mdc`、`.cursor/rules/app-registry.mdc`

## 参考设计

- `docs-project/小说管理页面子应用设计.MD`
- `docs-project/部署与Docker方案.md`
- **`docs-project/应用端口与命名注册表.md`**（`app_key=novel`）

## 目录

```
apps/novel-frontend/src/     # Vite dev :5174 · Docker :8081
apps/novel-backend/          # Egg.js   :7002 · DB novel_db
  views/
  stores/
  services/
  router/
  qiankun/
docker/novel-frontend.Dockerfile
```

## 小说子应用端口（app_key=novel）

| 用途 | 端口 / 库名 |
|------|-------------|
| Egg.js API | 7002 |
| Vite dev | 5174 |
| Nginx Docker | 8081 |
| PostgreSQL | `novel_db` |

## 实现顺序

1. Vite + React + Ant Design + `vite-plugin-qiankun`
2. 导出 Qiankun 生命周期（bootstrap/mount/unmount）
3. Router `basename` 从 props 获取
4. 多步骤表单草稿 → `sessionStorage` 或后端草稿 API
5. `docker build` 构建子应用镜像；dev 使用 **5174**，勿占用主应用 5173

## 验收

- [ ] 独立 `npm run dev` 可访问
- [ ] 嵌入主应用 basename 正确
- [ ] Docker 镜像可独立部署
