export const WORKFLOW_CATEGORIES = [
  { value: 'text_to_image', label: '文生图' },
  { value: 'image_to_video', label: '图生视频' },
  { value: 'image_edit', label: '改图' },
  { value: 'video', label: '视频' },
  { value: 'other', label: '其他' },
];

export function categoryLabel(value) {
  return WORKFLOW_CATEGORIES.find(item => item.value === value)?.label || value || '—';
}
