/**
 * 表格展示：有名称列时隐藏 id/code 列；单元格优先展示纯名称；状态列走 fitnessStatusTags
 */

import { isStatusColumn, statusCellLabel } from './fitnessStatusTags.js';

const EXPLICIT_ID_TO_NAME = {
  scheme_id: 'scheme_name',
  validation_id: 'validation_name',
  template_code: 'template_name',
  prd_goal_id: 'goal_name',
  risk_item_id: 'risk_name',
  main_item_id: 'main_item_name',
  source_item_id: 'source_item_name',
  target_item_id: 'target_item_name',
  automation_status_id: 'status_name',
  item_id: 'item_name',
};

export function resolveNameField(idProp) {
  if (EXPLICIT_ID_TO_NAME[idProp]) return EXPLICIT_ID_TO_NAME[idProp];
  if (idProp.endsWith('_id')) return `${idProp.slice(0, -3)}_name`;
  return null;
}

export function preferNameOnlyColumns(columns, rowKeys) {
  if (!columns?.length) return [];
  const keys = new Set(rowKeys || columns.map(c => c.prop));
  return columns.filter(col => {
    const nameProp = resolveNameField(col.prop);
    if (!nameProp) return true;
    return !keys.has(nameProp);
  });
}

export function cellDisplayValue(row, prop) {
  if (!row || prop == null) return '';

  const nameProp = resolveNameField(prop);
  if (nameProp && row[nameProp] != null && row[nameProp] !== '') return row[nameProp];

  const altKey = prop.replace(/_id$/, '_title');
  if (row[altKey] != null && row[altKey] !== '') return row[altKey];

  const nameKey = prop.endsWith('_name') ? null : `${prop}_name`;
  if (nameKey && row[nameKey] != null && row[nameKey] !== '') return row[nameKey];

  if (isStatusColumn(prop, row)) {
    return statusCellLabel(prop, row);
  }

  const v = row[prop];
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (Array.isArray(v)) return v.join(', ');
  if (prop.endsWith('pass_rate')) {
    const n = Number(v);
    if (Number.isFinite(n)) return `${n}%`;
  }
  return String(v);
}

export function cellTooltipValue(row, prop, columnLabel = '') {
  if (!row || prop == null) return '';
  const code = row[prop];
  const label = columnLabel || prop;
  const display = cellDisplayValue(row, prop);
  if (code == null || code === '') return display || '—';
  const codeStr = Array.isArray(code) ? code.join(', ') : String(code);
  if (display === codeStr || display === '—') return `${codeStr} · ${label}`;
  return `${codeStr} · ${display}`;
}

export function inferColumnsFromRow(row, columns) {
  const base = columns?.length
    ? columns
    : (row
      ? Object.keys(row).map(prop => ({ prop, label: prop }))
      : []);
  if (!row) return preferNameOnlyColumns(base, []);
  return preferNameOnlyColumns(base, Object.keys(row));
}
