# Pi Agent（novel-sub 内置模块）

**不是**独立仓库级服务。随 `novel-sub/deploy` 与 `ams-novel local` 一起启动。

## 本地

```bash
cd agent
cp .env.example .env
npm install
npm run dev    # :7003
```

## API

| 路径 | 说明 |
|------|------|
| `POST /api/chat` | SSE 对话 |
| `GET /api/llm/profiles` | 模型列表 |
| `GET /health` | 健康检查 |

工作区路径默认相对 `novel-sub/`（`workspace-templates`、`workspaces`、`data`）。
