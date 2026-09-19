/**
 * 公网访问时把 localhost / 127.0.0.1 换成当前页面 hostname（端口保留）。
 */
export function rewriteLoopbackHost(url) {
  if (!url || typeof window === 'undefined') return url;
  const raw = String(url).trim();
  if (!raw || raw.startsWith('/') || raw.startsWith('data:')) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return raw;
    }
    parsed.hostname = window.location.hostname;
    return parsed.toString();
  } catch {
    return raw;
  }
}
