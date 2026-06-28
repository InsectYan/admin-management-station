#!/usr/bin/env node
/**
 * 从 init.sql + display-labels.json + table-doc-meta.json 生成各表 表说明.md
 * 用法: node database/_scripts/generate-table-docs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '..');
const tablesDir = path.join(dbDir, 'tables');
const order = JSON.parse(fs.readFileSync(path.join(dbDir, 'tables-order.json'), 'utf8'));
const labels = JSON.parse(fs.readFileSync(path.join(dbDir, 'display-labels.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'table-doc-meta.json'), 'utf8'));

/** 字段补充说明（覆盖/增强 display-labels） */
const FIELD_NOTES = {
  test_dimension: {
    dimension_id: '主键，单字符 A–H',
    default_scheme_id: 'FK → test_scheme_enum，维度级默认主 TS',
    default_validation_id: 'FK → test_validation_enum，维度级默认主 VS',
    item_count: '该维度下活跃测试项数量（生成时统计）',
    doc: '来源 markdown 文件名',
  },
  test_category_major: {
    category_major_id: '主键，如 A1、C1、B2、E_RISK',
    dimension_id: 'FK → test_dimension',
    default_scheme_id: 'FK → test_scheme_enum，大类默认主 TS',
    default_validation_id: 'FK → test_validation_enum，大类默认主 VS（继承维度）',
    item_count: '该大类下用例数',
  },
  test_category_minor: {
    category_minor_id: '主键，如 C1_MACRO、B2_GUARD',
    category_major_id: 'FK → test_category_major',
    sort_order: '同大类内展示排序',
  },
  test_category_minor_scheme: {
    category_minor_id: 'PK/FK → test_category_minor',
    item_prefix: '对应 test_item_id 前缀，如 C1-MACRO-',
    scheme_primary_id: 'FK → test_scheme_enum',
    scheme_secondary_id: 'FK → test_scheme_enum，可选辅 TS',
    validation_primary_id: 'FK → test_validation_enum',
    validation_secondary_id: 'FK → test_validation_enum，可选辅 VS',
    mapping_source: 'scheme-map.json 或 dimension/major-default',
  },
  test_scheme_enum: {
    scheme_id: '主键，TS-01-DET … TS-10-MAN',
    sort_order: '方案展示顺序',
  },
  test_validation_enum: {
    validation_id: '主键，VS-01-EXACT … VS-11-MAJORITY；含 VS-04-CHAIN 别名',
    validation_group: 'DETERMINISTIC | STATISTICAL | SLO | OBSERVABILITY | MANUAL',
    rate_level: '达标率档 L/M/H（VS-07-RATE-*）',
    block_level: '安全阻断档 L/M/H（VS-09-BLOCK-*）',
    slo_level: '性能 SLO 档 L/M/H（VS-10-SLO-*）',
  },
  test_scheme_validation_pair: {
    pair_id: '主键，P01–P18',
    scheme_id: 'FK → test_scheme_enum',
    validation_id: 'FK → test_validation_enum',
    is_primary: '是否推荐为主配对',
  },
  test_priority_enum: {
    priority_id: '主键 P0/P1/P2/P3',
  },
  test_automation_status_enum: {
    automation_status_id: 'AUTO_EXISTING | AUTO_PARTIAL | AUTO_TODO | AUTO_MANUAL',
  },
  test_station_enum: {
    station_id: '主键 NONE 或 S01–S06',
    station_no: '流水线序号 0–6',
    arch_ref_id: 'FK → arch_reference，本站架构章节',
  },
  test_role_enum: {
    role_scope_id: 'COACH | MEMBER | MANAGER | ALL | SYSTEM',
  },
  config_env_enum: {
    config_env_id: '主键，如 TURN_QUEUE_MAX_PENDING',
    domain: '配置域：guard | queue | pipeline | memory 等',
    default_value: '文档默认值或占位说明',
  },
  automation_entry_enum: {
    automation_entry_id: '主键，如 AUTO_S02、AUTO_E2E_GENERIC',
    command_template: '命令模板或 npm script 说明',
  },
  threshold_param_enum: {
    param_id: '主键，如 rate_M、passk_N',
    validation_id: 'FK → test_validation_enum，所属 VS 类型',
    placeholder: '发版计划填写占位说明',
  },
  prd_goal: {
    prd_goal_id: '主键 G01–G10',
    goal_no: '目标序号 1–10',
    name: '目标中文名称',
    primary_dimension: '主要关联维度/大类，逗号分隔',
  },
  prd_reference: {
    prd_ref_id: '主键，如 PRD_4_1',
    title: '章节标题',
    section: 'PRD 节号',
  },
  arch_reference: {
    arch_ref_id: '主键，如 ARCH_B2',
    station: '关联六站编号（可选）',
  },
  test_item_prefix_scheme: {
    mapping_id: '主键 MAP0001…',
    item_prefix: '最长前缀匹配键；可精确 ID 或 C1-MACRO- 形式',
    scheme_primary_id: 'FK → test_scheme_enum',
    scheme_secondary_id: 'FK → test_scheme_enum',
    validation_primary_id: 'FK → test_validation_enum',
    validation_secondary_id: 'FK → test_validation_enum',
    mapping_source: '来源 *-方案映射.md 文件名',
  },
  test_item_relation_type_enum: {
    relation_type_id: 'GUARD | DETECT | VERIFY | SYMPTOM',
  },
  test_item_detail: {
    item_id: '主键，如 C1-MACRO-001',
    item_name: '可读标题，含编码与子类摘要',
    dimension_id: 'FK → test_dimension',
    category_major_id: 'FK → test_category_major',
    category_minor_id: 'FK → test_category_minor',
    sub_class: 'md 子类列或 GENERAL',
    detail_summary: '测什么：核心细节一句话',
    expected_observation: '期望观测/断言摘要',
    test_input_example: '示例输入（意图句、载荷等）',
    preconditions: 'JSONB 前置条件数组',
    test_steps: 'JSONB 执行步骤数组',
    assertion_points: 'JSONB 断言点数组',
    priority_id: 'FK → test_priority_enum',
    scheme_primary_id: 'FK → test_scheme_enum 主 TS',
    scheme_secondary_id: 'FK → test_scheme_enum 辅 TS',
    validation_primary_id: 'FK → test_validation_enum 主 VS',
    validation_secondary_id: 'FK → test_validation_enum 辅 VS',
    sample_execution_note: '样本/重复/链路执行说明',
    scheme_mapping_source: '方案来源：scheme-map.json 或 *-方案映射.md',
    prd_ref_id: 'FK → prd_reference 主 PRD 章节',
    prd_ref_ids: 'JSONB 多 PRD 章节 ID',
    arch_ref_id: 'FK → arch_reference 主架构引用',
    arch_ref_ids: 'JSONB 多架构 ID',
    prd_goal_ids: 'JSONB G01–G10 数组（规范化请 JOIN 关联表）',
    automation_status_id: 'FK → test_automation_status_enum',
    automation_entry_id: 'FK → automation_entry_enum',
    automation_command: '可执行 shell/npm 命令',
    config_env: '原始配置文本（兼容旧字段）',
    config_env_id: 'FK → config_env_enum',
    station_id: 'FK → test_station_enum，默认 NONE',
    role_scope_id: 'FK → test_role_enum，默认 ALL',
    endpoint_path: 'HTTP 路径，如 /api/chat/turns/submit',
    http_method: 'GET | POST 等',
    http_status_expected: '期望 HTTP 状态码',
    is_risk_flag: '是否高风险清单项',
    is_observability_audit: '是否可观测稽核项',
    is_p0_blocker: '是否 P0 发版阻塞项',
    failure_symptom: 'F5 症状→测试 描述',
    code_reference: '代码/测试文件路径',
    tags: 'JSONB 标签数组',
    source_doc: '来源 md 文件名',
    source_section: '来源节号如 C1.3、B2',
    is_active: '是否启用（软删标记）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  test_item_prd_goal_link: {
    link_id: '主键',
    item_id: 'FK → test_item_detail',
    prd_goal_id: 'FK → prd_goal',
  },
  test_item_prd_ref_link: {
    link_id: '主键',
    item_id: 'FK → test_item_detail',
    prd_ref_id: 'FK → prd_reference',
  },
  test_item_arch_ref_link: {
    link_id: '主键',
    item_id: 'FK → test_item_detail',
    arch_ref_id: 'FK → arch_reference',
  },
  test_item_risk_link: {
    link_id: '主键',
    risk_item_id: 'FK → test_item_detail，风险/症状项（E-RISK-* 等）',
    main_item_id: 'FK → test_item_detail，被防护/验证的主链项',
    relation_type_id: 'FK → test_item_relation_type_enum',
    is_primary: '是否主防护项',
    risk_category: '风险分类标签',
  },
};

function parseTableOrView(sql, name) {
  const isView = /CREATE\s+OR\s+REPLACE\s+VIEW/i.test(sql);
  const re = isView
    ? new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+VIEW\\s+${name}\\s+AS`, 'i')
    : new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${name}\\s*\\(`, 'i');
  if (!re.test(sql)) return { isView, columns: [] };

  if (isView) {
    return { isView: true, columns: parseViewSelectColumns(sql) };
  }

  const m = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\(([\\s\\S]*?)\\)\\s*;`, 'i'));
  if (!m) return { isView: false, columns: [] };

  const columns = [];
  for (const chunk of splitBody(m[1])) {
    const trimmed = chunk.trim();
    if (!trimmed || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(trimmed)) continue;
    const col = parseColumn(trimmed);
    if (col) columns.push(col);
  }
  return { isView: false, columns };
}

function splitBody(body) {
  const parts = [];
  let cur = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseColumn(line) {
  const m = line.match(/^"?(\w+)"?\s+([\s\S]+)$/);
  if (!m) return null;
  const name = m[1];
  let rest = m[2].trim();
  const pk = /\bPRIMARY KEY\b/i.test(rest);
  const notNull = /\bNOT NULL\b/i.test(rest);
  const ref = rest.match(/\bREFERENCES\s+"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)/i);
  rest = rest.replace(/\s+REFERENCES\s+[\s\S]+$/i, '').replace(/\s+PRIMARY KEY/i, '').trim();
  const type = rest.split(/\s+/)[0];
  return { name, type, pk, notNull, refTable: ref?.[1], refCol: ref?.[2] };
}

function parseViewSelectColumns(sql) {
  const sel = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (!sel) return [];
  return sel[1].split(',').map(part => {
    const as = part.match(/\s+AS\s+(\w+)\s*$/i);
    const raw = part.trim();
    const name = as ? as[1] : raw.split('.').pop().replace(/"/g, '').trim();
    return { name, type: '—', pk: false, notNull: false, computed: true };
  });
}

function rowCount(table) {
  const f = path.join(tablesDir, table, 'data.json');
  if (!fs.existsSync(f)) return null;
  try {
    const rows = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

function insertCount(table) {
  const init = path.join(tablesDir, table, 'init.sql');
  if (!fs.existsSync(init)) return null;
  const n = (fs.readFileSync(init, 'utf8').match(/^INSERT\s+/gim) || []).length;
  return n || null;
}

function colLabel(table, col) {
  return labels.tables?.[table]?.columns?.[col]
    || labels.tables?.[table]?.fk?.[col]?.as
    || col;
}

function colNote(table, col) {
  return FIELD_NOTES[table]?.[col] || '';
}

function scanAllRelations() {
  const outgoing = {};
  const incoming = {};
  for (const table of order) {
    if (table.startsWith('v_')) continue;
    const initFile = path.join(tablesDir, table, 'init.sql');
    if (!fs.existsSync(initFile)) continue;
    const { columns } = parseTableOrView(fs.readFileSync(initFile, 'utf8'), table);
    for (const c of columns) {
      if (!c.refTable) continue;
      outgoing[table] = outgoing[table] || [];
      outgoing[table].push({ field: c.name, refTable: c.refTable, refCol: c.refCol, type: 'N:1' });
      incoming[c.refTable] = incoming[c.refTable] || [];
      incoming[c.refTable].push({ fromTable: table, field: c.name, refCol: c.refCol, type: '1:N' });
    }
  }
  return { outgoing, incoming };
}

function buildDoc(table, rel) {
  const initFile = path.join(tablesDir, table, 'init.sql');
  if (!fs.existsSync(initFile)) return null;
  const sql = fs.readFileSync(initFile, 'utf8');
  const parsed = parseTableOrView(sql, table);
  const m = meta[table] || {};
  const isView = parsed.isView || m.type === 'view';
  const title = m.title || labels.tables?.[table]?.label || table;
  const count = rowCount(table) ?? insertCount(table);
  const countLine = count != null ? `共 **${count}** 条${isView ? '样例' : ''}。` : '';

  let md = `# ${table} · ${title}\n\n`;
  md += `> ${m.summary || (isView ? '分析/指标视图' : 'Fitness 测试体系数据表')}\n\n`;
  if (countLine) md += `${countLine}\n\n`;
  if (m.purpose) md += `## 表用途\n\n${m.purpose}\n\n`;

  md += `## 字段说明\n\n`;
  md += `| 字段 | 类型 | 约束 | 中文名 | 说明 |\n`;
  md += `|------|------|------|--------|------|\n`;
  for (const c of parsed.columns) {
    const constraints = [
      c.pk ? 'PK' : '',
      c.notNull ? 'NOT NULL' : '',
      c.refTable ? `FK→${c.refTable}` : '',
      c.computed ? '计算列' : '',
    ].filter(Boolean).join(' ') || '—';
    const note = colNote(table, c.name) || (c.refTable ? `关联 ${c.refTable}.${c.refCol || '?'}` : '—');
    md += `| \`${c.name}\` | ${c.type} | ${constraints} | ${colLabel(table, c.name)} | ${note} |\n`;
  }

  const out = rel.outgoing[table] || [];
  const inn = rel.incoming[table] || [];
  if (out.length || inn.length) {
    md += `\n## 关联关系\n\n`;
    if (out.length) {
      md += `### 本表引用（外键）\n\n`;
      md += `| 本表字段 | 关联表 | 关联字段 | 关系 |\n|----------|--------|----------|------|\n`;
      for (const r of out) {
        md += `| \`${r.field}\` | \`${r.refTable}\` | \`${r.refCol}\` | ${r.type} |\n`;
      }
    }
    if (inn.length) {
      md += `\n### 被其他表引用\n\n`;
      md += `| 引用表 | 外键字段 | 关系 |\n|--------|----------|------|\n`;
      for (const r of inn) {
        md += `| \`${r.fromTable}\` | \`${r.field}\` | ${r.type} |\n`;
      }
    }
  }

  if (isView) {
    md += `\n## 视图说明\n\n`;
    md += `- **类型**：${table.startsWith('v_metric_') ? '指标类视图' : table.startsWith('v_analysis_') ? '分析类视图' : '关联类视图'}\n`;
    md += `- **依赖**：基表数据导入后由 \`ams-testgen db\` 自动 CREATE OR REPLACE\n`;
    md += `- **data.json**：快照样例，供前端/报表对接参考，不参与 seed\n\n`;
    md += `\`\`\`sql\nSELECT * FROM ${table};\n\`\`\`\n`;
  } else {
    md += `\n## 数据文件\n\n`;
    md += `| 文件 | 说明 |\n|------|------|\n`;
    md += `| \`init.sql\` | DDL${insertCount(table) ? ' + INSERT' : ''} |\n`;
    md += `| \`data.json\` | ${insertCount(table) ? '冗余备份/展示 enrich 字段' : '种子数据（db-cli 注入）'} |\n`;
  }

  return md;
}

function main() {
  const rel = scanAllRelations();
  let n = 0;
  for (const table of order) {
    const doc = buildDoc(table, rel);
    if (!doc) continue;
    const out = path.join(tablesDir, table, '表说明.md');
    fs.writeFileSync(out, doc, 'utf8');
    n += 1;
    console.log(`[doc] ${table}/表说明.md`);
  }
  console.log(`完成，更新 ${n} 个表说明`);
}

main();
