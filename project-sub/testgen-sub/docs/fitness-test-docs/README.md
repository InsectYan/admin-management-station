# Fitness 测试文档（testgen-sub 本地副本）

> **上游真源**：[`fitness-agent-test-docs`](../../../../../../fitness-agent-test-docs/)（同 monorepo 根目录）  
> **引入日期**：2026-07-04  
> **用途**：testgen-sub 数据库种子、`source_doc` / `scheme_mapping_source` 字段、方案解析脚本的可读真源。

本目录为 **testgen-sub 工作副本**。改测试项或 TS/VS 映射时，须**先改此处 Markdown**，再联动 `database/` 与解析脚本（见 `.cursor/rules/fitness-test-docs-sync.mdc`）。

---

## 文档结构

| 路径 | 说明 | DB 关联字段 |
|------|------|-------------|
| [测试用例分类体系.md](./测试用例分类体系.md) | A–H 维度、大类/子类、编号规范 | 分类枚举表 |
| [测试方案分类说明.md](./测试方案分类说明.md) | TS / VS 枚举定义 | `test_scheme_enum`、`test_validation_enum` |
| [PRD文档.md](./PRD文档.md) | PRD 全文引用 | `source_doc`（部分项） |
| [测试项核心细节/](./测试项核心细节/README.md) | 各维度测试项明细表 | `test_item_detail.source_doc`、`source_section` |
| [测试方案核心细节与方案关系/](./测试方案核心细节与方案关系/README.md) | TS/VS 方案映射表 | `scheme_mapping_source`、`test_item_prefix_scheme.mapping_source` |
| [文档与数据库字段对照.md](./文档与数据库字段对照.md) | 字段 ↔ 文档 ↔ 脚本对照 | — |

---

## 方案映射文件一览

| 映射文件 | 核心细节表 |
|----------|------------|
| [A-方案映射.md](./测试方案核心细节与方案关系/A-方案映射.md) | [A-测试层级.md](./测试项核心细节/A-测试层级.md) |
| [B-方案映射.md](./测试方案核心细节与方案关系/B-方案映射.md) | [B-六站流水线.md](./测试项核心细节/B-六站流水线.md) |
| [C1–C4-方案映射.md](./测试方案核心细节与方案关系/) | C1–C4 业务细节表 |
| [D–H-方案映射.md](./测试方案核心细节与方案关系/) | D–H 细节表 |

粗粒度前缀兜底见 [`database/scheme-map.json`](../../database/scheme-map.json)（`scheme_mapping_source = scheme-map.json`）。

---

## 维护命令

```bash
cd admin-management-station/project-sub/testgen-sub

# 从本目录 *-方案映射.md 解析并写回 prefix 表 + 补全 item TS/VS
node backend/scripts/sync-scheme-mapping-from-docs.js --write

# 仅校验文档与 DB 是否一致（不写文件）
node backend/scripts/sync-scheme-mapping-from-docs.js --check
```

改 `test_item_detail` 自动化或新增测试项后，另见 `fitness-agent-test-automation-sync.mdc`。
