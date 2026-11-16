export function framePromptText(prompt) {
  const start = String(prompt?.frame_start_zh || '').trim();
  const end = String(prompt?.frame_end_zh || '').trim();
  return [ start && `首帧：${start}`, end && `尾帧：${end}` ].filter(Boolean).join('\n');
}

export function hasPromptSet(prompt) {
  return Boolean(
    String(prompt?.positive_zh || '').trim()
    && String(prompt?.frame_start_zh || '').trim()
    && String(prompt?.frame_end_zh || '').trim()
    && String(prompt?.negative_zh || '').trim(),
  );
}

function styleName(label) {
  return String(label || '').trim().replace(/【[\s\S]*】$/, '').trim();
}

export function collapseFrameStyle(text, label, prompt) {
  let body = String(text || '');
  const essay = String(prompt || '').trim();
  const name = styleName(label);
  if (essay) body = body.split(essay).join('');
  body = body.replace(/【风格】[\s\S]*?(?=【[^】]{1,16}】|$)/g, '');
  body = body.replace(/画面风格：[^\n]*/g, '');
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`${escaped}【\\s*】`, 'g'), '');
  }
  body = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const head = [];
  if (name) head.push(`画面风格：${name}`);
  if (essay) head.push(essay);
  if (!head.length) return body;
  return body ? `${head.join('\n')}\n${body}` : head.join('\n');
}

export function withReferenceUse(text, line) {
  const extra = String(line || '').trim();
  const source = String(text || '').trim();
  if (!extra) return source;
  return source ? `${extra}\n${source}` : extra;
}

export function referenceUseLine(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const characters = [];
  const scenes = [];
  list.forEach((entry, index) => {
    const name = String(entry?.name || '').trim();
    if (!name) return;
    const picture = `图${index + 1}`;
    if (entry.scene) scenes.push({ picture, name });
    else characters.push({ picture, name });
  });
  const parts = [];
  if (characters.length) {
    const pics = characters.map(item => item.picture).join('、');
    const names = characters.map(item => `「${item.name}」`).join('、');
    parts.push(`以${pics}的角色${names}外观为参考，只保留面部特征、发型、身材比例和服装细节`);
  }
  if (scenes.length) {
    const pics = scenes.map(item => item.picture).join('、');
    const names = scenes.map(item => `「${item.name}」`).join('、');
    const interior = scenes.every(item => /室|房|厅|卧|宅|殿|阁|厢/.test(item.name));
    const keep = interior ? '家具特征和细节比例' : '空间特征和细节比例';
    parts.push(`以${pics}的场景${names}外观为背景参考，只保留场景${names}的${keep}`);
  }
  if (!parts.length) return '';
  return `**${parts.join('；')}。不要复制三视图、不要出现多个视角、不要拼贴正面侧面背面、不要出现角色设定图排版。**`;
}
