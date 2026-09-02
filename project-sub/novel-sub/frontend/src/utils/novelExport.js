function safeFileName(title) {
  const raw = String(title || '小说').trim() || '小说';
  return raw.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

export function readerToMarkdown(reader = {}) {
  const lines = [`# ${reader.title || '未命名小说'}`, ''];
  for (const vol of reader.volumes || []) {
    const volTitle = String(vol.title || '').trim();
    if (volTitle && volTitle !== '全部章节') {
      lines.push(`## ${volTitle}`, '');
    }
    for (const ch of vol.chapters || []) {
      lines.push(`### ${ch.title || '未命名章节'}`, '');
      const body = String(ch.body || '').trim();
      lines.push(body || '（未撰写）', '');
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportReader(reader, format = 'md') {
  const text = readerToMarkdown(reader);
  const name = safeFileName(reader.title);
  if (format === 'txt') {
    downloadText(`${name}.txt`, text, 'text/plain;charset=utf-8');
    return;
  }
  downloadText(`${name}.md`, text, 'text/markdown;charset=utf-8');
}
