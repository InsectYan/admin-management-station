export const PROJECT_TYPE_OPTIONS = [
  { value: 'frontend', label: '前端' },
  { value: 'backend', label: '后端' },
  { value: 'fullstack', label: '全栈' },
  { value: 'agent', label: 'Agent' },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: 'draft', label: '梳理中', type: 'info' },
  { value: 'active', label: '在维护', type: 'success' },
  { value: 'archived', label: '已归档', type: 'warning' },
];

export const NODE_TYPE_OPTIONS = [
  { value: 'start', label: '开始' },
  { value: 'page', label: '页面' },
  { value: 'api', label: '接口' },
  { value: 'action', label: '动作' },
  { value: 'decision', label: '判断' },
  { value: 'end', label: '结束' },
];

export const NODE_SEVERITY_OPTIONS = [
  { value: '', label: '无' },
  { value: 'warning', label: '警告（橙）' },
  { value: 'risk', label: '风险（红）' },
];

export const EDGE_TYPE_OPTIONS = [
  { value: 'next', label: '下一步' },
  { value: 'success', label: '成功' },
  { value: 'fail', label: '失败' },
  { value: 'branch', label: '分支' },
];

export function typeLabel(value) {
  return PROJECT_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '未分类';
}

export function statusMeta(value) {
  return PROJECT_STATUS_OPTIONS.find((item) => item.value === value)
    || { value, label: value || '未知', type: 'info' };
}

export function nodeTypeLabel(value) {
  return NODE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value;
}

export function coverFallback(name) {
  const text = String(name || '').trim();
  return text ? text.slice(0, 1).toUpperCase() : '项';
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function countTreeNodes(nodes) {
  return (nodes || []).reduce((sum, node) => {
    return sum + 1 + countTreeNodes(node.children);
  }, 0);
}

export function countRoutes(nodes) {
  return (nodes || []).reduce((sum, node) => {
    return sum + 1 + countRoutes(node.children);
  }, 0);
}

export function countFlowNodes(flows) {
  return (flows || []).reduce((sum, flow) => sum + (flow.nodes?.length || 0), 0);
}

function hostDocument() {
  const rawWindow = typeof window !== 'undefined' ? (window.rawWindow || window) : null;
  return rawWindow?.document || document;
}

export function downloadJson(filename, data) {
  if (data == null) {
    throw new Error('没有可导出的数据');
  }
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const doc = hostDocument();
  const view = typeof window !== 'undefined' ? (window.rawWindow || window) : window;
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename || 'download.json';
  link.rel = 'noopener';
  link.style.display = 'none';
  // 阻止 qiankun / Vue Router 把 <a> 当成应用内导航；延后 revoke 避免 Chrome 读已释放 blob 的 startTime
  link.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  doc.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view }));
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function emptyOverviewFlow() {
  return {
    key: 'overview',
    name: '项目总览',
    description: '概览整个项目的页面与模块关系',
    ref_path: '',
    nodes: [
      { id: 'start', name: '开始', type: 'start', description: '', x: 80, y: 160 },
      { id: 'n1', name: '功能入口', type: 'page', description: '', x: 280, y: 160 },
      { id: 'end', name: '结束', type: 'end', description: '', x: 500, y: 160 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'n1', label: '', type: 'next' },
      { id: 'e2', source: 'n1', target: 'end', label: '完成', type: 'success' },
    ],
  };
}

export function emptyFlow() {
  return {
    key: `flow-${Date.now()}`,
    name: '新功能流程',
    description: '',
    ref_path: '',
    nodes: [
      { id: 'start', name: '开始', type: 'start', description: '', x: 80, y: 160 },
      { id: 'n1', name: '功能入口', type: 'page', description: '', x: 280, y: 160 },
      { id: 'end', name: '结束', type: 'end', description: '', x: 500, y: 160 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'n1', label: '', type: 'next' },
      { id: 'e2', source: 'n1', target: 'end', label: '完成', type: 'success' },
    ],
  };
}

export function ensureOverviewFlow(flows) {
  const list = Array.isArray(flows) ? [...flows] : [];
  if (!list.some((flow) => flow.key === 'overview')) {
    list.unshift(emptyOverviewFlow());
  }
  return list;
}

export function flowsForTarget(flows, target = {}) {
  const list = Array.isArray(flows) ? flows : [];
  const bound = String(target.flow_key || '').trim();
  if (!bound) return [];
  return list.filter((flow) => flow.key === bound);
}
