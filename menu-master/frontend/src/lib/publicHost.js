/**
 * 浏览器用公网 IP/域名打开时，把开发态 localhost / 127.0.0.1
 * 改成当前页面的 hostname（端口与路径不变）。
 * 便于 ECS 等环境不写死公网地址。
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
