export const NODE_COLORS = {
  start: { fill: 'rgba(109,138,130,.18)', stroke: '#6D8A82' },
  end: { fill: 'rgba(109,138,130,.18)', stroke: '#6D8A82' },
  page: { fill: 'rgba(47,138,91,.16)', stroke: '#2F8A5B' },
  api: { fill: 'rgba(91,168,124,.18)', stroke: '#5BA87C' },
  action: { fill: 'rgba(109,138,130,.14)', stroke: '#6D8A82' },
  decision: { fill: 'rgba(74,144,164,.16)', stroke: '#4A90A4' },
};

export const SEVERITY_COLORS = {
  warning: { fill: 'rgba(230,162,60,.20)', stroke: '#E6A23C' },
  risk: { fill: 'rgba(245,108,108,.20)', stroke: '#F56C6C' },
};

export const EDGE_COLORS = {
  next: '#6D8A82',
  success: '#2F8A5B',
  fail: '#F56C6C',
  branch: '#E6A23C',
};

export const NODE_LEGEND = [
  { value: 'start', label: '开始' },
  { value: 'page', label: '页面' },
  { value: 'api', label: '接口' },
  { value: 'action', label: '动作' },
  { value: 'decision', label: '判断' },
  { value: 'end', label: '结束' },
];

export const SEVERITY_LEGEND = [
  { value: 'warning', label: '警告标注' },
  { value: 'risk', label: '风险标注' },
];

export function resolveNodeColor(node) {
  const base = NODE_COLORS[node?.type] || NODE_COLORS.action;
  if (node?.severity === 'risk') {
    return { fill: base.fill, stroke: SEVERITY_COLORS.risk.stroke };
  }
  if (node?.severity === 'warning') {
    return { fill: base.fill, stroke: SEVERITY_COLORS.warning.stroke };
  }
  return base;
}
