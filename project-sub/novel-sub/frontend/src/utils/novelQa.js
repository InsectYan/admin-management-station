export const QA_MODULE_META = [
  { key: 'basic', label: '立意与概要', hint: '书名、立意、短简介、小说概要、类型基调' },
  { key: 'world', label: '世界观与背景', hint: '纪元、地理、力量体系、社会史' },
  { key: 'factions', label: '门派组织', hint: '势力是否齐全、命名是否冲突' },
  { key: 'characters', label: '人物与关系', hint: '主角、门派归属、关系边' },
  { key: 'outline', label: '篇幅大纲', hint: '卷组节是否足以支撑目录' },
  { key: 'content', label: '章节目录', hint: 'outline_ref 是否悬空' },
  { key: 'continuity', label: '正文连续性', hint: '组织/地名是否入库、篇幅是否过短' },
];

export function healthStatusLabel(status) {
  if (status === 'pass') return '健康';
  if (status === 'warn') return '需关注';
  if (status === 'fail') return '未通过';
  return '未核检';
}

export function healthTagType(status) {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warning';
  if (status === 'fail') return 'danger';
  return 'info';
}

export function moduleStatusIcon(status) {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warning';
  if (status === 'fail') return 'danger';
  if (status === 'info') return 'info';
  return 'info';
}

export function severityTagType(severity) {
  if (severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}
