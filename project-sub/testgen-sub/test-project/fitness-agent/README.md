# fitness-agent · 被测项目文件集

> **用途**：testgen-sub 平台管理的被测项目（SUT）资料，供测试用例生成、缺口追踪与自动化规划引用。  
> **被测仓库**：[`fitness-agent`](../../../../../fitness-agent/)（Pi 三端：教练 / 会员 / 店长）  
> **梳理日期**：2026-07-02  
> **关联测试文档**：[`fitness-agent/server/tests`](../../../../../fitness-agent/server/tests/README.md) · [`fitness-agent-test-docs`](../../../../../fitness-agent-test-docs/测试用例分类体系.md)

---

## 目录说明

| 文件 | 说明 |
|------|------|
| [单测缺口梳理.md](./单测缺口梳理.md) | **主文档**：现有覆盖、六站 + platform 缺失单测、优先级、测试项 ID 映射 |
| [建议新增测试文件.md](./建议新增测试文件.md) | 建议在 fitness-agent 仓库内新增的测试文件路径与命名 |
| [运行命令与前置.md](./运行命令与前置.md) | 站级 / E2E / 类型检查命令及环境前置 |

---

## 项目概要

fitness-agent 采用 **六站流水线** 架构（s01 前端 → s02 门禁 → s03 队列 → s04 Pipeline → s05 Pi → s06 回传），async-only 主链。

| 站 | 代码路径 | 现有站级测试入口 |
|----|----------|------------------|
| s01 前端 | `fitness-agent/frontend/` | `frontend/tests/s01-frontend.test.mjs` |
| s02 门禁 | `server/src/stations/s02-gate/` | `tests/turn-submit-guard.test.ts` |
| s03 队列 | `server/src/stations/s03-queue/` | `tests/turn-job-store.test.ts` |
| s04 Pipeline | `server/src/stations/s04-pipeline/` | `tests/s04-pipeline.test.ts` |
| s05 Pi | `server/src/stations/s05-pi/` | `tests/s05-pi.test.ts` |
| s06 回传 | `server/src/stations/s06-stream/` | `tests/turn-journey.test.ts` |
| 全栈 E2E | `server/tests/e2e/` | `full-stack.e2e.test.ts` |

---

## 缺口摘要（P0）

以下项 **尚无站级/单测覆盖**，且适合不依赖 LLM 的自测：

1. DB 熔断（`dbCircuitBreaker` → 503）
2. 队列硬顶 / 软提示（`turnQueuePolicy`）
3. outbox 全 `message_type` 契约（`validateCoachOutbox` 其余分支）
4. 会员/店长载荷边界（`validatePortalOutbox`，仅 `text`）
5. 队列 claim / complete / stale 回收（`turnJobStore` 生命周期）
6. 前端 + 后端 SSE 帧解析

详见 [单测缺口梳理.md](./单测缺口梳理.md)。

---

## 快速命令

```bash
# 在 fitness-agent/server 目录
npm run test:stations   # s01~s06 站级（s02~s06 需 Postgres）
npm run test:e2e        # 全栈 E2E（需 Docker :3001 + LLM Key）
npm run typecheck
```

完整说明见 [运行命令与前置.md](./运行命令与前置.md)。
