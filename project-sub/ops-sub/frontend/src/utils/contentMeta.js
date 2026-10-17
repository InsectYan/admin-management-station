export const BIZ_OPTIONS = [
  { value: 'platform', label: '全部平台' },
  { value: 'cartoon', label: '漫剧' },
  { value: 'novel', label: '小说' },
];

export const TASK_STATUS_OPTIONS = [
  { value: 'queued', label: '待处理' },
  { value: 'running', label: '处理中' },
  { value: 'success', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

const TASK_STATUS = {
  pending: { label: '待处理', type: 'info' },
  queued: { label: '待处理', type: 'info' },
  running: { label: '处理中', type: 'warning' },
  saving: { label: '处理中', type: 'warning' },
  success: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
};

const ALERT_STATUS = {
  open: { label: '未处理', type: 'danger' },
  ack: { label: '已认领', type: 'warning' },
  resolved: { label: '已解决', type: 'success' },
};

export function taskStatusMeta(status) {
  return TASK_STATUS[status] || { label: status || '未知', type: 'info' };
}

export function alertStatusMeta(status) {
  return ALERT_STATUS[status] || { label: status || '未知', type: 'info' };
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const value = Math.max(0, Math.round(Number(seconds)));
  if (value < 60) return `${value} 秒`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}

export function kindLabel(kind) {
  if (kind === 'video') return '首尾帧';
  if (kind === 'i2v') return '图生视频';
  if (kind === 'edit') return '改图';
  if (kind === 'image') return '文生图';
  return kind || '—';
}
