export function framePromptText(prompt) {
  const start = String(prompt?.frame_start_zh || '').trim();
  const end = String(prompt?.frame_end_zh || '').trim();
  if (!start && !end) return '';
  return `首帧：${start || '—'}\n尾帧：${end || '—'}`;
}

export function hasPromptSet(prompt) {
  return Boolean(
    String(prompt?.positive_zh || '').trim()
    && String(prompt?.frame_start_zh || '').trim()
    && String(prompt?.frame_end_zh || '').trim()
    && String(prompt?.negative_zh || '').trim()
  );
}
