export function rewriteLoopbackHost(url) {
  if (!url || typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = window.location.hostname;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function consumeHandedToken() {
  const params = new URLSearchParams(window.location.search);
  const handed = params.get('ams_token');
  if (!handed) return;
  localStorage.setItem('ams_access_token', handed);
  params.delete('ams_token');
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
  window.history.replaceState({}, '', next);
}

export function getAccessToken() {
  try { return localStorage.getItem('ams_access_token') || ''; } catch { return ''; }
}

export function redirectToLogin() {
  localStorage.removeItem('ams_access_token');
  const main = rewriteLoopbackHost(import.meta.env.VITE_MAIN_ORIGIN || 'http://localhost:5100');
  window.location.assign(`${main}/login?redirect=${encodeURIComponent(window.location.href)}`);
}
