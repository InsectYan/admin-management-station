/** 将 extract 对象序列化为 UI 文本：var:$.path，多组换行 */
export function extractToText(extract) {
  if (!extract || typeof extract !== 'object') return '';
  return Object.entries(extract)
    .map(([ k, v ]) => `${k}:${v}`)
    .join('\n');
}

/** 解析 extract 文本，支持换行/逗号/分号分隔的多组 var:path */
export function parseExtractText(text) {
  const extract = {};
  if (!text || !String(text).trim()) return extract;
  const parts = String(text).split(/[\n,;]+/);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const path = part.slice(idx + 1).trim();
    if (key && path) extract[key] = path;
  }
  return extract;
}

export function defaultChainStep() {
  return {
    runner: 'http',
    path: '/health',
    method: 'GET',
    expect_status: 200,
    command: '',
    extractText: '',
    extract: {},
    extract_hint: '',
    input_params_text: '',
    input_params: [],
  };
}

export function serializeChainStep(row) {
  const { extractText, input_params_text, ...rest } = row;
  const extract = parseExtractText(extractText);
  const input_params = String(input_params_text || '')
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  const text = String(extractText || '').trim();
  const paramsText = String(input_params_text || '').trim();
  return {
    ...rest,
    // 保留 UI 文本，避免 v-model 回写时丢失未解析完的输入
    extractText: text || undefined,
    input_params_text: paramsText || undefined,
    extract: Object.keys(extract).length ? extract : undefined,
    extract_hint: rest.extract_hint || undefined,
    input_params: input_params.length ? input_params : undefined,
  };
}

export function normalizeChainStep(raw) {
  const row = { ...defaultChainStep(), ...raw };
  row.extractText = extractToText(row.extract) || row.extractText || '';
  row.input_params_text = (raw.input_params || []).join(',');
  if (!Object.keys(row.extract || {}).length && row.extractText) {
    row.extract = parseExtractText(row.extractText);
  }
  return row;
}
