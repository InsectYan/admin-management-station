# PI-场景与角色

> 真源：`fitness-agent/.pi`

## A1

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-SCENE-001 | scene 缺省 | coach 缺省 scene | defaultSceneForRole(coach)=coach_ops_chat | P0 | 已有 .pi 单测 |
| PI-SCENE-002 | scene 缺省 | member 缺省 scene | defaultSceneForRole(member)=member_consult | P0 | 已有 .pi 单测 |
| PI-SCENE-003 | scene 缺省 | manager 缺省 scene | defaultSceneForRole(manager)=manager_ops | P0 | 已有 .pi 单测 |
| PI-SCENE-004 | scene 错配 | member 请求 coach_ops_chat | resolveScene 失败 / HTTP 400 | P0 | 已有 .pi 单测 |
| PI-SCENE-005 | scene 非法 | 未知 scene_code | resolveScene 失败 | P0 | 已有 .pi 单测 |

## A2

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-SCENE-006 | profile 围栏 | coach_profile_chat 仅允许 text | isMessageTypeAllowedForScene(profile, text)=true；plan_form/session_plan=false | P0 | 已有 .pi 单测 |
| PI-SCENE-007 | profile 围栏 | profile 场景 emit plan_form 硬拦 | writeOutboxFile 抛错 / outbox_scene_forbidden；磁盘无非法 outbox | P0 | 已有 .pi 单测 |
| PI-SCENE-008 | profile skills | profile 只挂人设相关 skill 子集 | 含 coach-profile；不含 generate-macro-plan | P0 | 已有 .pi 单测 |
| PI-SCENE-009 | ops 全量 | coach_ops_chat 挂全量 skills 目录 | resolveAdditionalSkillPaths 返回 skills 根目录 | P1 | 已有 .pi 单测 |
| PI-SCENE-010 | profile 自然语言 | 人设场景请求生成计划 | 仅 text；不得声称已发表单/计划 | P0 | 待建 |

