# fitness-agent · 被测项目（SUT）文档

> testgen-sub 平台对 [`fitness-agent`](../../../../../fitness-agent/) 的测试资料集：站级单测索引、缺口追踪、执行命令与主表自动化字段同步。

| 元信息 | 值 |
|--------|-----|
| 被测仓库 | Pi 三端（教练 / 会员 / 店长） |
| 架构 | 六站流水线 s01→s06 |
| 文档版本 | 2026-07-02 |
| 权威命令说明 | [`fitness-agent/server/tests/README.md`](../../../../../fitness-agent/server/tests/README.md) |
| 测试分类体系 | [`fitness-agent-test-docs`](../../../../../fitness-agent-test-docs/测试用例分类体系.md) |

---

## 文档导航

| 文档 | 用途 |
|------|------|
| [站级测试清单.md](./站级测试清单.md) | **已实现**的站级测试文件、filter 命令、DB 依赖 |
| [单测缺口梳理.md](./单测缺口梳理.md) | P0 已覆盖 vs P1/P2 仍缺项 |
| [运行命令与前置.md](./运行命令与前置.md) | 一起测 / 单一测命令速查 |
| [数据库自动化同步.md](./数据库自动化同步.md) | `test_item_detail` 自动化字段维护 |
| [scripts/sync-automation-status.mjs](./scripts/sync-automation-status.mjs) | 批量回写 `data.json` 的脚本 |

---

## 覆盖率快照（2026-07-02）

| 层级 | 一起测 | 单一测示例 |
|------|--------|------------|
| 站级 s01~s06 | `cd fitness-agent/server && npm run test:stations` | `npm run test:stations -- db-circuit` |
| 全栈 E2E | `npm run test:e2e` | `npm run test:e2e -- chain` |

**P0 单测已落地**：DB 熔断、队列策略、Internal Key、队列 lifecycle/retry、outbox 全类型契约、会员/店长载荷、SSE 帧、draft merge、前端 queue hint。

**仍待补（P1+）**：`readAgentSseStream` 全事件解析、会员/店长 session 归属、portal pipeline 幂等 replay、HTTP 轮询兜底等。详见 [单测缺口梳理.md](./单测缺口梳理.md)。

---

## 本地环境

```bash
# 启动 fitness-agent 全栈（Postgres + Server + 前端）
fitness local

# 清运行时数据（对话/计划/队列，保留种子人物）
fitness local:clean

# 站级全量（在 fitness-agent/server）
npm run test:stations
```

---

## testgen-sub 侧维护

新增或修改 fitness-agent 单测后：

1. 更新 [站级测试清单.md](./站级测试清单.md) 与 [单测缺口梳理.md](./单测缺口梳理.md)
2. 在 `scripts/sync-automation-status.mjs` 的 `PATCH` 中登记 `item_id`
3. 运行同步并注入 DB → 见 [数据库自动化同步.md](./数据库自动化同步.md)
