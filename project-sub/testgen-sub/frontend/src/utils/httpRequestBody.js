export const METHODS_WITH_BODY = [ 'POST', 'PUT', 'PATCH' ];

export function methodNeedsBody(method) {
  return METHODS_WITH_BODY.includes(String(method || 'GET').toUpperCase());
}

export function parseJsonBodyText(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: true, value: undefined };
  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    return { ok: false, error: '须为 JSON 对象或数组，以 { 或 [ 开头' };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON 解析失败' };
  }
}

export function bodyTextFromConfig(config = {}) {
  if (config.body != null && typeof config.body === 'object') {
    return JSON.stringify(config.body, null, 2);
  }
  const example = config.test_input_example;
  if (example == null) return '';
  if (typeof example === 'object') return JSON.stringify(example, null, 2);
  return String(example);
}

export function headersTextFromConfig(config = {}) {
  if (!config.headers || typeof config.headers !== 'object') return '';
  return JSON.stringify(config.headers, null, 2);
}

export function bodyHintForMethod(method, endpointPath = '') {
  const m = String(method || 'GET').toUpperCase();
  if (!methodNeedsBody(m)) {
    return `${m} 请求无需 Body；下方内容仅作用例说明，不会随请求发送。`;
  }
  const path = String(endpointPath || '');
  let extra = '';
  if (path.includes('/turns/submit')) {
    extra = ' submit 首次成功通常为 202，相同 client_turn_id 幂等重试为 200。';
    extra += ' 受保护接口请在「请求头」中配置 X-Internal-Service-Key。';
  }
  return `须填写合法 JSON 对象，执行时会作为 ${m} 请求体发送。${extra}`;
}

export function bodyPlaceholderForPath(endpointPath = '') {
  const path = String(endpointPath || '');
  if (path.includes('/turns/submit')) {
    return `{
  "coach_id": 1,
  "session_id": "uuid",
  "message": "你好",
  "client_turn_id": "uuid",
  "user_id": 10002
}`;
  }
  if (path.includes('/sessions/ensure') || path.includes('/sessions')) {
    return '{ "coach_id": 1 }';
  }
  return '{ "key": "value" }';
}
