export const WORKFLOW_CATEGORIES = [
  { value: 'text_to_image', label: '文生图' },
  { value: 'text_to_video', label: '文生视频' },
  { value: 'image_to_video', label: '图生视频' },
  { value: 'image_edit', label: '改图' },
  { value: 'image_to_prompt', label: '反推提示词' },
  { value: 'video', label: '视频' },
  { value: 'other', label: '其他' },
];

export const WORKFLOW_KINDS = [
  { value: 'text_to_image', label: '文生图' },
  { value: 'image_to_image', label: '图生图' },
  { value: 'text_to_video', label: '文生视频' },
  { value: 'flf_video', label: '首尾帧视频' },
  { value: 'image_to_prompt', label: '反推提示词' },
];

export function categoryLabel(value) {
  return WORKFLOW_CATEGORIES.find(item => item.value === value)?.label || value || '—';
}

export function workflowKind(row) {
  const name = String(row?.name || '');
  const category = String(row?.category || '');
  if (category === 'image_to_prompt' || name.includes('反推')) return 'image_to_prompt';
  if (name.includes('首尾帧')) return 'flf_video';
  if (category === 'text_to_video') return 'text_to_video';
  if (category === 'text_to_image') return 'text_to_image';
  if (category === 'image_edit') return 'image_to_image';
  return '';
}

export function listKindLabel(row) {
  const kind = workflowKind(row);
  return WORKFLOW_KINDS.find(item => item.value === kind)?.label || categoryLabel(row?.category);
}
