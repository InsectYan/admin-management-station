# 子应用前端工作流（React + Ant Design + Vite）

> 编码规范：`.cursor/rules/react-web.mdc`、`.cursor/rules/react-antd.mdc`、`.cursor/rules/docker.mdc`

## 参考设计

- `docs-project/小说管理页面子应用设计.MD`
- `docs-project/部署与Docker方案.md`

## 目录

```
apps/novel-frontend/src/
  views/          # 列表、详情、新建 Steps
  stores/         # 步骤草稿（sessionStorage）
  services/       # HTTP API
  router/
  qiankun/
docker/novel-frontend.Dockerfile
```

## 实现顺序

1. Vite + React + Ant Design + `vite-plugin-qiankun`
2. 导出 Qiankun 生命周期（bootstrap/mount/unmount）
3. Router `basename` 从 props 获取
4. 多步骤表单草稿 → `sessionStorage` 或后端草稿 API
5. `docker build` 构建子应用镜像，dev 端口 8081

## 验收

- [ ] 独立 `npm run dev` 可访问
- [ ] 嵌入主应用 basename 正确
- [ ] Docker 镜像可独立部署
