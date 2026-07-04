# D · 接口与套壳 — 核心细节表

## D1 · 接口正常路径

| 测试项 ID | 接口 | 方法 | 测试核心细节 | 预期 | 优先级 | 自动化 |
|-----------|------|------|--------------|------|--------|--------|
| D1-COACH-SUB-001 | `/api/chat/turns/submit` | POST | 合法 body + Key | 202 + turn_id | P0 | E2E |
| D1-COACH-STR-001 | `/api/chat/turns/:id/stream` | GET | submit 后订 SSE | message + done | P0 | E2E |
| D1-COACH-CFG-001 | `/api/chat/turns/config` | GET | — | mode=async, worker_enabled | P2 | smoke |
| D1-MEM-SUB-001 | `/api/member/chat/turns/submit` | POST | member 合法 | 202 | P0 | E2E |
| D1-ADM-SUB-001 | `/api/admin/chat/turns/submit` | POST | manager 合法 | 202 | P0 | E2E |
| D1-CANCEL-001 | `.../turns/cancel` | POST | pending turn | cancelled | P1 | 部分 |
| D1-POLL-001 | `.../turns/:id` | GET | 轮询兜底 | status + stream_events | P1 | 待建 |
| D1-SESSION-001 | `/api/sessions/ensure` | POST | 会员/店长 session | upsert FK | P1 | 部分 |
| D1-HEALTH-001 | `/health` | GET | DB 断连 | 200 degraded | P1 | smoke |
| D1-READY-001 | `/ready` | GET | 预热前 | 503 → 200 | P1 | smoke |

## D2 · 接口异常 / 错误码

| 测试项 ID | 场景 | HTTP | 响应要点 | 优先级 | 自动化 |
|-----------|------|------|----------|--------|--------|
| D2-SUB-001 | 缺 session_id | 400 | error 文案 | P0 | 待建 |
| D2-SUB-002 | 缺 client_turn_id | 400 | — | P0 | 待建 |
| D2-SUB-003 | 缺 message | 400 | — | P0 | s02 |
| D2-SUB-004 | 在途第二条 | 429 | retry_after_sec | P0 | s02 |
| D2-SUB-005 | 队列满 | 503 | queue_meta, Retry-After | P0 | 待建 |
| D2-SUB-006 | 错 Key | 401 | unauthorized | P0 | 待建 |
| D2-SUB-007 | session 归属 | 403 | — | P0 | s02 |
| D2-SSE-001 | failed turn | SSE/ poll | error_text | P1 | E2E 部分 |
| D2-IDEM-001 | 重复 submit 同 id | 202 | 同 turn_id, 不双 Pi | P0 | s03 |
| D2-OUT-001 | 202 契约 | 202 | turn_id, poll_interval_ms | P1 | E2E |

## D3 · 套壳联调（pi-shell-integration）

| 测试项 ID | 子类 | 测试核心细节 | 预期 | 优先级 |
|-----------|------|--------------|------|--------|
| D3-JWT-001 | JWT 映射 | body 伪造 coach_id | 套壳覆盖为 JWT 用户 | P0 |
| D3-KEY-001 | Internal Key | 仅套壳服务端带 Key | 前端 bundle 无 Key | P0 |
| D3-NET-001 | 网络 | 浏览器→套壳→Agent 内网 | Agent 无公网裸奔 | P0 |
| D3-CORS-001 | CORS | 生产域名 | 与 CORS_ORIGIN 一致 | P1 |
| D3-PASSTHR-001 | 透传 | submit/stream | 字段不篡改 | P1 |

## D4 · 202 / SSE 载荷字段（教练 submit 成功）

| 字段 | 测试关注 | 测试项 ID |
|------|----------|-----------|
| turn_id | 后续 stream 必用 | D4-FLD-001 |
| status | pending | D4-FLD-002 |
| created | 新入队 true / 幂等 false | D4-FLD-003 |
| queue_meta.pending | ≥WARN 时出现 | D4-FLD-004 |
| queue_meta.estimated_wait_sec | 估算合理 | P2 |

## D5 · SSE 事件类型

| event | data 要点 | 测试项 ID |
|-------|-----------|-----------|
| status | phase, label | D5-EVT-001 |
| thinking | delta | D5-EVT-002 |
| trace | 工具步骤 | D5-EVT-003 |
| message | final 载荷 | D5-EVT-004 |
| done | [DONE] | D5-EVT-005 |
