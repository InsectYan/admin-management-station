/**
 * Vite + qiankun experimentalStyleIsolation：
 * 首次 mount 注入的 style/link 会在 unmount 时被摘掉；二次 mount 不会重跑 CSS import。
 * 在 unmount 前快照，mount 时用 Node.appendChild 还原，避免沙箱二次加前缀。
 */
export function createQiankunStyleKeeper({ appName, pathHint, rootClass }) {
  let snapshot = [];

  function normalize(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function matches(el) {
    if (el.getAttribute('data-qiankun') === appName) return true;
    if (el.getAttribute('data-ams-style-app') === appName) return true;
    const viteId = normalize(el.getAttribute('data-vite-dev-id'));
    if (pathHint && viteId.includes(pathHint)) return true;
    const href = normalize(el.getAttribute('href') || el.href);
    if (pathHint && href.includes(pathHint)) return true;
    if (href.includes(appName)) return true;
    const text = el.textContent || '';
    if (rootClass && text.includes(`.${rootClass}`)) return true;
    if (text.includes(`[data-qiankun="${appName}"]`)) return true;
    return false;
  }

  function save() {
    snapshot = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .filter(matches)
      .map((el) => {
        const clone = el.cloneNode(true);
        clone.setAttribute('data-ams-style-app', appName);
        return clone;
      });
  }

  function alreadyPresent(el) {
    const viteId = el.getAttribute('data-vite-dev-id');
    if (viteId) {
      return Array.from(document.querySelectorAll('style[data-vite-dev-id]'))
        .some((node) => node.getAttribute('data-vite-dev-id') === viteId);
    }
    const href = el.getAttribute('href');
    if (href) {
      return !!document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    }
    return false;
  }

  function restore() {
    if (!snapshot.length) return;
    snapshot.forEach((el) => {
      if (alreadyPresent(el)) return;
      Node.prototype.appendChild.call(document.head, el.cloneNode(true));
    });
  }

  return { save, restore };
}
