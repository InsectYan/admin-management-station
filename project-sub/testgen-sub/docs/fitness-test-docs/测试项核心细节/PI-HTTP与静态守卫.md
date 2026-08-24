# PI-HTTP与静态守卫

> 真源：`fitness-agent/.pi`

## H1

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-HTTP-001 | turn | 三端 pipeline turn 入口 | coach/member/manager-turn 可接受合法请求 | P1 | 待建 |
| PI-HTTP-002 | turn | scene_code 错配 400 | HTTP 400 | P0 | 待建 |
| PI-HTTP-003 | abort | turns abort | 可中止在途 turn | P1 | 待建 |
| PI-HTTP-004 | workspace | coach-member / member-coach 切换 | 工作区绑定接口成功 | P1 | 待建 |
| PI-HTTP-005 | 探针 | health/ready 放行 | 无 Key 亦可访问 /health /ready | P1 | 待建 |

## H2

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-STATIC-001 | 工程守卫 | 角色目录 import 隔离 | role-isolation-guard 通过 | P0 | 已有 .pi 单测 |
| PI-STATIC-002 | 工程守卫 | member/manager kernel 对称 | role-kernel-parity 通过 | P1 | 已有 .pi 单测 |
| PI-STATIC-003 | 工程守卫 | text-role 幂等 replay | replay 不重写 log | P1 | 已有 .pi 单测 |
| PI-STATIC-004 | 契约套件 | harness outbox-contract + text-role-payload | harness.test 套件通过 | P0 | 已有 .pi 单测 |

