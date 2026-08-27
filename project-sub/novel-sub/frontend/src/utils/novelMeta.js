export const GENRE_OPTIONS = [
  '玄幻', '言情', '历史', '都市', '悬疑', '奇幻',
];

export const NOVEL_TYPE_OPTIONS = [
  '长篇', '中篇', '短篇',
];

export const PROGRESS_OPTIONS = [
  { value: 'ongoing', label: '连载中' },
  { value: 'completed', label: '已完结' },
];

export const TARGET_AUDIENCE_OPTIONS = [
  '青少年', '成人', '全年龄',
];

export const UPDATE_CADENCE_OPTIONS = [
  '日更', '周更', '月更', '不定期',
];

export const GENRE_TAG_TYPE = {
  玄幻: '',
  言情: 'danger',
  历史: 'warning',
  都市: 'info',
  悬疑: 'success',
  奇幻: 'primary',
};

export function progressLabel(status) {
  return PROGRESS_OPTIONS.find((o) => o.value === status)?.label || status || '-';
}

export function coverFallback(title) {
  return (title || '?').trim().charAt(0);
}

export const TABLE_COLUMNS = [
  { key: 'title', label: '小说名称', defaultVisible: true, minWidth: 200 },
  { key: 'genre', label: '题材', defaultVisible: true, width: 100 },
  { key: 'novel_type', label: '小说类型', defaultVisible: true, width: 100 },
  { key: 'progress_status', label: '进度', defaultVisible: true, width: 120 },
  { key: 'updated_at', label: '更新时间', defaultVisible: true, width: 170, sortable: true },
  { key: 'created_at', label: '创建时间', defaultVisible: false, width: 170, sortable: true },
];
