# PI-记忆工具思考

> 真源：`fitness-agent/.pi`

## G1

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-MEM-001 | 记忆路径 | 记忆唯一路径 memory_ops | emit 附 memory_ops；禁当轮 write MEMORY.md | P0 | 待建 |
| PI-MEM-002 | 记忆路径 | 会员说「记住」偏好 | 可附 memory_ops；不写业务档案表 | P1 | 待建 |
| PI-MEM-003 | 归档 | MEMORY 超限切分归档 | 字节/单元切分行为符合单测 | P1 | 已有 .pi 单测 |

## G2

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-TOOL-001 | 教练工具 | 教练工具白名单 | 含 lookup/check_*；不含 assign_member | P1 | 待建 |
| PI-TOOL-002 | 知识工具 | 三端 knowledge 工具只读 | search_knowledge/read_wiki_page/list_raw/read_raw 可用且不写 raw | P1 | 待建 |
| PI-WIKI-001 | wiki | wiki 检索 BM25/hybrid | wiki-search / embedding 单测通过 | P1 | 已有 .pi 单测 |

## G3

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-THINK-001 | 思考脱敏 | 思考禁 skill 名/message_type | thinking 脱敏过滤内部标识 | P0 | 已有 .pi 单测 |
| PI-THINK-002 | 思考脱敏 | 思考禁 user_id/cls_/文件名泄露 | 数字主键与内部路径不出现在可见思考 | P1 | 已有 .pi 单测 |
| PI-THINK-003 | 思考中文 | 思考步骤全程中文 | 禁止英文整段步骤清单 | P1 | 待建 |

