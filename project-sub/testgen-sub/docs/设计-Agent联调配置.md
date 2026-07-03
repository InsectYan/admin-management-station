# Agent 平台与 testgen-sub 联调配置

> **Agent 插件源码**：`agent-management-sub/plugins/`（运行时挂载到 `agent-management-master/plugins/`）  
> **testgen BFF**：`project-sub/testgen-sub/backend/`（端口 **5202**）  
> **文档索引**：[README.md](./README.md) · **任务勾选**：[待办-Agent开发任务清单.md](./待办-Agent开发任务清单.md)

最后更新：**2026-07-03**

---

## 0. 项目关联地图

开发 Agent 联调时，以下文件须**同步维护**（改 API / env / Skill 后至少更新本表与本文件 §3～§5）：

| 层级 | 路径 | 职责 |
|------|------|------|
| **联调真源（本文）** | `docs/设计-Agent联调配置.md` | 端口、Token、双向 API、验证命令 |
| 协作设计 | `docs/设计-Agent协作与Skill嵌入.md` | Skill 清单 CH-AG-01～05、引擎 hook |
| 任务追踪 | `docs/待办-Agent开发任务清单.md` | Phase 0～7 勾选 |
| 架构图 | `docs/测试平台架构关系图.md` | 序列图、表关系 |
| 执行技术 | `docs/FITNESS_EXECUTION_TECH.md` | 执行引擎 + internal API |
| BFF 配置 | `backend/config/config.default.js` | `agentPlatform` · `internalApiToken` |
| BFF 代理 | `backend/app/service/agentProxy.js` | `invokeTestgen` / `invokeFitness*` |
| internal 路由 | `backend/app/router.js` | `/api/internal/*` |
| Token 校验 | `backend/app/lib/internalAuth.js` | `X-Internal-Token` |
| 生成任务 | `backend/app/service/generationJob.js` | `agent_context` 读写 |
| Skill 回写 | `agent-management-sub/plugins/testgen-skill/lib/bffClient.js` | Agent → BFF |
| 环境样例 | `backend/.env.example` · `deploy/config/.env.local` | 端口与 URL |
| 离线冒烟 | `backend/scripts/e6-smoke.js` | Skill 规则降级（无需 Agent） |
| **在线探活** | `backend/scripts/agent-linkage-smoke.js` | BFF + Agent + Token |
| Cursor 规则 | `.cursor/rules/agent-skill-development.mdc` | 新 Skill 落点与联调登记 |
| AMS 端口注册 | `docs-project/应用端口与命名注册表.md` | 4001 / 5202 / 5302 |

---

## 1. 端口对照（AMS 注册表）

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| Agent 平台 API | **4001** | `agent-management-master` → `PORT` |
| testgen BFF | **5202** | `TESTGEN_PORT` / `PORT` |
| testgen 前端 dev | **5102** | Vite |
| testgen Postgres | **5302** | `POSTGRES_PORT` |
| Agent Postgres | **5500** | 独立，非 53xx 段 |

**历史遗留**：Agent 平台代码里仍有 `3001` 默认值（fitness BFF 段，**不是** Agent 平台）。  
testgen 的 `AGENT_PLATFORM_URL` 已按注册表指向 **4001**。联调时二选一：

- **推荐**：Agent `.env` 设 `PORT=4001`
- **或**：testgen `.env` 设 `AGENT_PLATFORM_URL=http://127.0.0.1:3001`（与 Agent **实际**监听端口一致）

Docker 内 testgen API 调宿主机 Agent：`AGENT_PLATFORM_URL=http://host.docker.internal:4001`（见 `deploy/config/.env.local`）。

---

## 2. 双向调用关系

```mermaid
flowchart LR
  UI[testgen 前端 5102] --> BFF[testgen BFF 5202]
  BFF -->|POST /api/skills/*/invoke| Agent[Agent 平台 4001]
  Agent -->|testgen-skill Loop| Skill[plugins/testgen-skill]
  Skill -->|X-Internal-Token| Internal[/api/internal/*]
  Internal --> BFF
  BFF --> PG[(testgen_db 5302)]
```

---

## 3. API 对照表

### 3.1 testgen BFF → Agent（`agentProxy.js`）

| Skill | invoke 路径 | BFF 调用方 | 典型 action |
|-------|-------------|------------|-------------|
| testgen-skill | `/api/skills/testgen-skill/invoke` | `generationJob` | `generate` · `generate_for_fitness` |
| fitness-judge-skill | `/api/skills/fitness-judge-skill/invoke` | `fitnessExecution` · `fitnessPlan` · `agentHook` | `judge` · `pre_review` · `summary` · `explain` |
| fitness-sample-skill | `/api/skills/fitness-sample-skill/invoke` | `fitnessExecution` · `configTemplate` · `agentHook` | `enrich_samples` · `enrich_csv` |
| fitness-config-skill | `/api/skills/fitness-config-skill/invoke` | `configTemplate` | `generate_config` |
| fitness-explore-skill | `/api/skills/fitness-explore-skill/invoke` | `agentHook`（TS-05） | `explore` |
| perf-bottleneck-skill | `/api/skills/perf-bottleneck-skill/invoke` | `fitnessExecution` · `testRun` | perf 分析 |

路径可通过 env 覆盖（见 §5.2 `FITNESS_*_INVOKE_PATH`）。

### 3.2 BFF 公开 API → Agent（UI 入口）

| 用户操作 | BFF 路由 | 触发的 Skill |
|----------|----------|--------------|
| 文档生成任务 | `POST /api/generation-jobs` | testgen-skill |
| 样本 AI 生成 | `POST /api/fitness/samples/generate` | fitness-sample-skill |
| 配置页 AI 生成 | `POST /api/fitness/template-config/items/:id/generate` | fitness-config-skill / sample |
| 执行前评审 | `POST /api/fitness/runs/:id/pre-review` | fitness-judge-skill |
| 计划报告摘要 | `POST /api/fitness/plans/:id/summary` | fitness-judge-skill |
| 负载分析 | `POST /api/fitness/runs/:id/analyze-load` | perf-bottleneck-skill |
| 引擎 hook（编排内） | `runOrchestrator` → `agentHook` | judge / sample / explore |

进度页：`GET /api/generation-jobs/:id` 读取 `agent_context`（Agent 经 internal 回写）。

### 3.3 Agent → testgen（`testgen-skill/lib/bffClient.js`）

| 用途 | 方法 | 路径 |
|------|------|------|
| 文档 | GET | `/api/documents/:id` |
| 知识库 | GET | `/api/tools/knowledge` |
| 生成进度 | POST | `/api/internal/generation-jobs/:id/agent-context` |
| 测试项建议 | GET | `/api/internal/fitness/items/suggest` |
| 批量写样本 | POST | `/api/internal/fitness/samples/bulk` |
| 更新测试项 | PATCH | `/api/internal/fitness/items/:itemId` |
| dry-run 执行 | POST | `/api/internal/fitness/run/:itemId/dry-run` |

请求头：`X-Internal-Token: <与 INTERNAL_API_TOKEN 相同>`（未配置 Token 时 BFF **开发模式放行**，生产须设 Token）。

### 3.4 `agent_context` 字段（进度页 `AgentConfigPanel`）

Agent / BFF 合并写入 `generation_jobs.agent_context`（JSONB）：

| 字段 | 说明 |
|------|------|
| `current_phase` | `analyze` / `functional` / `edge` / `review` / … |
| `system_prompt` · `user_prompt` | 当前步提示词（Agent 上报） |
| `llm_profile` · `model` | 模型与 profile |
| `fitness_post_process` | dry-run / patch / bulk 后处理结果 |
| `fitness_dry_run` · `fitness_dry_run_error` | dry-run 明细 |
| `fitness_samples` · `fitness_samples_error` | 样本写入结果 |
| `retry_notice` | 重试提示 |
| `updated_at` | ISO 时间戳 |

已有库缺列：`database/migrations/001_add_agent_context.sql`（见根 `README.md`）。

---

## 4. 环境变量

### 4.1 Agent 平台（`.env` 或 Docker env）

```env
PORT=4001
TESTGEN_BFF_URL=http://127.0.0.1:5202
TESTGEN_INTERNAL_TOKEN=<与 testgen 相同>
OLLAMA_BASE_URL=http://localhost:11434/v1
LLM_DEFAULT_PROFILE=ollama-qwen
```

Docker 内 Agent 调宿主机 testgen：

```env
TESTGEN_BFF_URL=http://host.docker.internal:5202
```

### 4.2 testgen-sub/backend（`.env`）

```env
TESTGEN_PORT=5202
AGENT_PLATFORM_URL=http://127.0.0.1:4001
INTERNAL_API_TOKEN=<与 TESTGEN_INTERNAL_TOKEN 相同>
POSTGRES_PORT=5302

# 可选：Skill 路径 / 超时
# AGENT_PLATFORM_TIMEOUT=300000
# FITNESS_JUDGE_TIMEOUT_MS=120000
# FITNESS_CONFIG_INVOKE_PATH=/api/skills/fitness-config-skill/invoke

# Fitness CLI 执行（dry-run / TS-01）
# FITNESS_AGENT_ROOT=e:/AI Tools/projects/fitness-agent
# FT_CLI_AUTO_INSTALL=false
```

`INTERNAL_API_TOKEN`（testgen）≡ `TESTGEN_INTERNAL_TOKEN`（Agent），**必须完全相同**（生产环境）。

### 4.3 deploy Docker（`deploy/config/.env.local`）

| 变量 | 说明 |
|------|------|
| `AGENT_PLATFORM_URL` | 容器内访问宿主机 Agent，通常 `host.docker.internal:4001` |
| `FITNESS_AGENT_HOST_PATH` | 宿主机 fitness-agent 路径（挂载用） |
| `FITNESS_AGENT_ROOT` | 容器内 `/fitness-agent` |

---

## 5. 启动顺序与验证

### 5.1 启动顺序

```powershell
# 1. Ollama（若本地 LLM）
ollama serve

# 2. testgen 栈
cd admin-management-station/project-sub/testgen-sub/deploy
ams-testgen local          # 或 local:infra + backend npm run dev

# 3. Agent 平台
cd agent-management-master
# .env: PORT=4001, TESTGEN_BFF_URL, TESTGEN_INTERNAL_TOKEN
npm run dev                # 或 agentm local

# 4. 在线联调探活（推荐）
cd ../project-sub/testgen-sub/backend
node scripts/agent-linkage-smoke.js

# 5. 离线 Skill 规则（无需 Agent / DB）
node scripts/e6-smoke.js
```

### 5.2 手动 curl

```bash
curl http://127.0.0.1:5202/api/health
curl http://127.0.0.1:4001/health
curl http://127.0.0.1:4001/ready
curl http://127.0.0.1:4001/api/plugins

curl -X POST http://127.0.0.1:4001/api/skills/fitness-judge-skill/invoke \
  -H "Content-Type: application/json" \
  -d '{"action":"list-rubrics"}'
```

internal Token 探活：

```bash
curl -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  "http://127.0.0.1:5202/api/internal/fitness/items/suggest?limit=3"
```

---

## 6. 插件清单

放入 `agent-management-master/plugins/`（源码 `agent-management-sub/plugins/`）后**重启 Agent** 自动扫描：

| 目录 | dbTables | 说明 |
|------|----------|------|
| `testgen-skill/` | testgen_documents, testgen_runs | 用例生成 Loop；需 PG/SQLite sync |
| `fitness-judge-skill/` | — | 评审 / 摘要 / explain |
| `fitness-sample-skill/` | — | 样本 enrich |
| `fitness-config-skill/` | — | 配置模板 AI 生成（**BFF 已接，文档曾遗漏**） |
| `fitness-explore-skill/` | — | TS-05 explore hook |
| `perf-bottleneck-skill/` | perf_bottleneck_runs | 性能分析 |

---

## 7. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| testgen 调 Agent 504 | `AGENT_PLATFORM_URL` 端口不对 | 对齐 `PORT` 与 `4001/3001` |
| 生成 job 无 Agent 上下文 | `TESTGEN_BFF_URL` 仍为旧端口（如 7003） | 改为 `5202` |
| internal API 401 | Token 未配或不一致 | 两边设同一 token；header 名 `X-Internal-Token` |
| Skill 列表缺 fitness-config | 插件未部署或未 restart | `GET /api/plugins` · 跑 `agent-linkage-smoke.js` |
| judge 502 llm_error | Ollama 未启动或模型名不对 | 检查 `OLLAMA_MODEL` / profile |
| dry-run 找不到 fitness 代码 | `FITNESS_AGENT_ROOT` 未设 | 见 `backend/.env.example` |
| POST generation-jobs 500 | 旧库缺 `agent_context` 列 | 跑 `001_add_agent_context.sql` |
| 开发环境 internal 无 Token 仍 200 | `internalAuth` 空 Token 放行 | **生产必须设 Token** |

---

## 8. 已知缺口与优化项

| 优先级 | 项 | 状态 | 跟踪 |
|--------|-----|------|------|
| P0 | Agent 平台部署注册 6 个 Skill | ❌ 部署时 | [待办-Agent §Phase 1.5](./待办-Agent开发任务清单.md) |
| P0 | E6 在线 rubric + TS-04 联调 | 🔧 离线 e6-smoke ✅ | 同上 §1.6 |
| P1 | `agent-linkage-smoke.js` 纳入 CI | 🆕 脚本已加 | 本文件 §5.1 |
| P1 | 接口模板 + inject 样本集 + 多样本执行 | ✅ BFF/前端/引擎 | [设计-接口模板与样本集](./设计-接口模板与样本集.md) |
| P1 | `fitness-config-skill` 理解 inject_bindings | ⏳ | agent-management-master |
| P1 | `fitness-sample-skill` 生成 text/inject 样本 | ⏳ | agent-management-master |
| P2 | explore TEST_MODE mock 联调 | ❌ | 待办 §Phase 6 |
| P2 | generation-jobs `pause` 路由与前端对齐 | ⏳ 前端有调用、router 未注册 | 待办-开发节点 |
| P2 | 联调文档与 `configTemplate` action 清单自动校验 | ⏳ | 可扩展 smoke 脚本 |

完成联调后须同步：[待办-Agent开发任务清单.md](./待办-Agent开发任务清单.md) · [项目评分与后续计划.md](./项目评分与后续计划.md) §Agent。

---

*详见 [设计-Agent协作与Skill嵌入.md](./设计-Agent协作与Skill嵌入.md) · [FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md)*
