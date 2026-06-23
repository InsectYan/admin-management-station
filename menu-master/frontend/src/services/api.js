const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.message || res.statusText || '请求失败';
    throw new Error(message);
  }

  return body;
}

export { API_BASE, request };
