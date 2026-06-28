/**
 * 表格单元格：优先展示 *_name（中文），否则展示原字段
 * @param {Record<string, unknown>} row
 * @param {string} prop
 */
export function cellDisplayValue(row, prop) {
  if (!row || prop == null) return '';
  const nameKey = prop.endsWith('_id')
    ? `${prop.slice(0, -3)}_name`
    : `${prop}_name`;
  if (row[nameKey] != null && row[nameKey] !== '') return row[nameKey];
  const altKey = prop.replace(/_id$/, '_title');
  if (row[altKey] != null && row[altKey] !== '') return row[altKey];
  const v = row[prop];
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (Array.isArray(v)) return v.join(', ');
  // 纯编码字段无中文名时仍展示编码
  return String(v);
}

/**
 * Tooltip：code · 列标题（中文名）
 * @param {Record<string, unknown>} row
 * @param {string} prop
 * @param {string} [columnLabel]
 */
export function cellTooltipValue(row, prop, columnLabel = '') {
  if (!row || prop == null) return '';
  const code = row[prop];
  const label = columnLabel || prop;
  const display = cellDisplayValue(row, prop);
  if (code == null || code === '') return display || '—';
  const codeStr = Array.isArray(code) ? code.join(', ') : String(code);
  if (display === codeStr || display === '—') return `${codeStr} · ${label}`;
  return `${codeStr} · ${label}`;
}

/**
 * 过滤掉纯编码列（若已有对应名称列）
 * @param {{ prop: string, label: string }[]} columns
 */
export function preferNameColumns(columns) {
  if (!columns?.length) return [];
  const props = new Set(columns.map(c => c.prop));
  return columns.filter(col => {
    if (!col.prop.endsWith('_id')) return true;
    const nameProp = `${col.prop.slice(0, -3)}_name`;
    return !props.has(nameProp);
  });
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ prop: string, label: string }[]} columns
 */
export function inferColumnsFromRow(row, columns) {
  if (columns?.length) return preferNameColumns(columns);
  if (!row) return [];
  return Object.keys(row)
    .filter(k => !k.endsWith('_id') || !(`${k.slice(0, -3)}_name` in row))
    .map(prop => ({ prop, label: prop }));
}
