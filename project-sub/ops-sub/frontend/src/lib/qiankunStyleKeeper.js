/**
 * Vite + qiankun experimentalStyleIsolation：
 * 1. 首次 mount 注入的 style/link 会在 unmount 时被摘掉；二次 mount 不会重跑 CSS import。
 * 2. Docker 下各应用 Vite id 都是 `/app/src/...`，后一个子应用会按同一 data-vite-dev-id 覆盖前一个的 <style>。
 * unmount 前快照并卸下本应用样式；mount 时用原生 appendChild 还原。
 */
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

export const AMS_STYLE_NS = '::ams::';

export function createQiankunStyleKeeper({ appName, pathHint, rootClass }) {
  let snapshot = [];
  let observer = null;

  function isQiankun() {
    return !!qiankunWindow.__POWERED_BY_QIANKUN__;
  }

  function getRealHead() {
    const doc = qiankunWindow.document || document;
    const heads = doc.getElementsByTagName ? Array.from(doc.getElementsByTagName('head')) : [];
    const htmlHead = heads.find((el) => el.tagName === 'HEAD');
    if (htmlHead) return htmlHead;
    const scoped = doc.querySelector ? doc.querySelector('html > head') : null;
    if (scoped) return scoped;
    return doc.head;
  }

  function queryStyleNodes() {
    const doc = qiankunWindow.document || document;
    return Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'));
  }

  function normalize(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function rawViteId(id) {
    const value = String(id || '');
    const idx = value.indexOf(AMS_STYLE_NS);
    return idx >= 0 ? value.slice(0, idx) : value;
  }

  function matches(el) {
    if (el.getAttribute('data-qiankun') === appName) return true;
    if (el.getAttribute('data-ams-style-app') === appName) return true;
    const viteId = normalize(rawViteId(el.getAttribute('data-vite-dev-id')));
    if (pathHint && viteId.includes(pathHint)) return true;
    const href = normalize(el.getAttribute('href') || el.href);
    if (pathHint && href.includes(pathHint)) return true;
    if (href.includes(appName)) return true;
    const text = el.textContent || '';
    if (rootClass && text.includes(`.${rootClass}`)) return true;
    if (text.includes(`[data-qiankun="${appName}"]`)) return true;
    return false;
  }

  function nativeRemove(el) {
    const parent = el.parentNode;
    if (parent) Node.prototype.removeChild.call(parent, el);
  }

  function claimNow() {
    if (!isQiankun()) return;
    queryStyleNodes().forEach((el) => {
      const owner = el.getAttribute('data-ams-style-app');
      if (owner && owner !== appName) return;
      const viteId = el.getAttribute('data-vite-dev-id') || '';
      const namespacedToOther = viteId.includes(AMS_STYLE_NS) && !viteId.endsWith(`${AMS_STYLE_NS}${appName}`);
      if (namespacedToOther && owner !== appName) return;
      const unnamespacedVite = viteId && !viteId.includes(AMS_STYLE_NS);
      if (owner === appName || unnamespacedVite || matches(el)) {
        el.setAttribute('data-ams-style-app', appName);
      }
    });
  }

  function startClaiming() {
    if (!isQiankun()) return;
    claimNow();
    observer?.disconnect();
    const head = getRealHead();
    if (!head || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(() => claimNow());
    observer.observe(head, { childList: true });
  }

  function stopClaiming() {
    observer?.disconnect();
    observer = null;
  }

  function save() {
    if (!isQiankun()) return;
    stopClaiming();
    claimNow();
    const nodes = queryStyleNodes()
      .filter((el) => el.getAttribute('data-ams-style-app') === appName || matches(el));
    snapshot = nodes.map((el) => {
      el.setAttribute('data-ams-style-app', appName);
      const clone = el.cloneNode(true);
      clone.setAttribute('data-ams-style-app', appName);
      return clone;
    });
    nodes.forEach(nativeRemove);
  }

  function alreadyPresent(el) {
    const viteId = rawViteId(el.getAttribute('data-vite-dev-id'));
    if (viteId) {
      return queryStyleNodes().some((node) => (
        rawViteId(node.getAttribute('data-vite-dev-id')) === viteId
        && node.getAttribute('data-ams-style-app') === appName
      ));
    }
    const href = el.getAttribute('href');
    if (href) {
      return queryStyleNodes().some((node) => (
        node.getAttribute('href') === href
        && node.getAttribute('data-ams-style-app') === appName
      ));
    }
    return false;
  }

  function evictColliders(el) {
    const viteId = rawViteId(el.getAttribute('data-vite-dev-id'));
    if (!viteId) return;
    queryStyleNodes().forEach((node) => {
      if (rawViteId(node.getAttribute('data-vite-dev-id')) !== viteId) return;
      if (node.getAttribute('data-ams-style-app') === appName) return;
      if (node.getAttribute('data-ams-style-app') === 'host') return;
      nativeRemove(node);
    });
  }

  function restore() {
    if (!isQiankun() || !snapshot.length) return;
    const head = getRealHead();
    if (!head) return;
    snapshot.forEach((el) => {
      evictColliders(el);
      if (alreadyPresent(el)) return;
      Node.prototype.appendChild.call(head, el.cloneNode(true));
    });
  }

  return { save, restore, claim: startClaiming };
}
