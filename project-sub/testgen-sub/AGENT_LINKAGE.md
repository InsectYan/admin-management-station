# Agent 平台 ↔ testgen-sub 联调配置

> Agent 插件目录：`agent-management-master/plugins/`  
> 测试平台 BFF：`testgen-sub/backend/`（端口 **5202**）

---

## 1. 端口对照（AMS 注册表）

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| Agent 平台 API | **4001** | `agent-management-master` → `PORT` |
| testgen BFF | **5202** | `testgen-sub` → `TESTGEN_PORT` |
| testgen 前端 dev | 5102 | Vite |
| testgen Postgres | 5302 | `POSTGRES_PORT` |

**注意**：`agent-management-master` 代码里仍有大量 `3001` 默认值（历史遗留）。  
testgen 的 `AGENT_PLATFORM_URL` 已按注册表指向 **4001**。联调时请二选一：

- **推荐**：Agent 平台 `.env` 设 `PORT=4001`
- **或**：testgen `.env` 设 `AGENT_PLATFORM_URL=http://127.0.0.1:3001`（与 Agent 实际端口一致）

---

## 2. 双向调用关系

```
testgen BFF (5202)  ──POST /api/skills/{name}/invoke──►  Agent (4001)
       ▲
       │  GET/POST /api/internal/...  + X-Internal-Token
       │
testgen-skill（Loop 进度、Fitness internal API）
```

### testgen → Agent（BFF `agentProxy.js`）

| 用途 | 路径 |
|------|------|
| 用例生成 | `/api/skills/testgen-skill/invoke` |
| 语义判定 | `/api/skills/fitness-judge-skill/invoke` |
| 样本生成 | `/api/skills/fitness-sample-skill/invoke` |
| 探索步骤 | `/api/skills/fitness-explore-skill/invoke` |
| 性能分析 | `/api/skills/perf-bottleneck-skill/invoke` |

### Agent → testgen（`testgen-skill/lib/bffClient.js`）

| 用途 | 路径 |
|------|------|
| 文档 / 知识库 | `/api/documents/:id` · `/api/tools/knowledge` |
| 生成进度 | `POST /api/internal/generation-jobs/:id/agent-context` |
| Fitness 样本 | `POST /api/internal/fitness/samples/bulk` |
| 测试项建议 | `GET /api/internal/fitness/items/suggest` |
| dry-run | `POST /api/internal/fitness/run/:itemId/dry-run` |

---

## 3. 必须对齐的环境变量

### agent-management-master（`.env` 或 Docker env）

```env
PORT=4001
TESTGEN_BFF_URL=http://127.0.0.1:5202
TESTGEN_INTERNAL_TOKEN=<同一密钥>
OLLAMA_BASE_URL=http://localhost:11434/v1
LLM_DEFAULT_PROFILE=ollama-qwen
```

Docker 内 Agent 调宿主机 testgen：

```env
TESTGEN_BFF_URL=http://host.docker.internal:5202
```

### testgen-sub/backend（`.env`）

```env
TESTGEN_PORT=5202
AGENT_PLATFORM_URL=http://127.0.0.1:4001
INTERNAL_API_TOKEN=<同一密钥>
POSTGRES_PORT=5302
```

`INTERNAL_API_TOKEN`（testgen）必须与 `TESTGEN_INTERNAL_TOKEN`（Agent）**完全相同**。

---

## 4. 启动顺序与验证

```powershell
# 1. Ollama（若本地 LLM）
ollama serve

# 2. testgen 栈
cd admin-management-station/project-sub/testgen-sub
ams-testgen local          # 或 backend npm run dev

# 3. Agent 平台
cd agent-management-master
# 将 .env 中 PORT 改为 4001，并设置 TESTGEN_* 变量
npm run dev                # 或 agentm local

# 4. 探活
curl http://127.0.0.1:5202/api/health
curl http://127.0.0.1:4001/health
curl http://127.0.0.1:4001/ready

# 5. 列出已加载 Skill（应含 fitness-judge/sample/explore、testgen-skill）
curl http://127.0.0.1:4001/api/plugins
```

### 快速 invoke 测试

```bash
curl -X POST http://127.0.0.1:4001/api/skills/fitness-judge-skill/invoke \
  -H "Content-Type: application/json" \
  -d '{"action":"list-rubrics"}'
```

---

## 5. 插件清单（无需额外注册）

放入 `plugins/` 后重启 Agent 即可自动扫描：

| 目录 | dbTables | 说明 |
|------|----------|------|
| `testgen-skill/` | testgen_documents, testgen_runs | 需 PG/SQLite sync |
| `fitness-judge-skill/` | — | 无表 |
| `fitness-sample-skill/` | — | 无表 |
| `fitness-explore-skill/` | — | 无表 |
| `perf-bottleneck-skill/` | perf_bottleneck_runs | 旧 suite |

---

## 6. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| testgen 调 Agent 504 | `AGENT_PLATFORM_URL` 端口不对 | 对齐 `PORT` 与 `4001/3001` |
| 生成 job 无 Agent 上下文 | `TESTGEN_BFF_URL` 仍为 7003 | 改为 `5202` |
| internal API 401 | Token 未配或不一致 | 两边设同一 token |
| Skill 列表无 fitness-* | 插件未在 `plugins/` 或需 restart | `GET /api/plugins` 检查 |
| judge 502 llm_error | Ollama 未启动或模型名不对 | 检查 `OLLAMA_MODEL` |

---

*详见 [AGENT_TASKS.md](./AGENT_TASKS.md) · [FITNESS_AGENT_DIRECTION.md](./FITNESS_AGENT_DIRECTION.md)*
