/**
 * Qiankun 会把子应用 <head> 换成自定义标签 qiankun-head 塞进容器。
 * 入口 HTML 里的 meta / BOM / 空白文本也会成为 #app 的兄弟节点，按一行字高占位。
 * 宿主须在加载下一个子应用前给已有 Vite 样式改名，避免 /app/src 路径碰撞。
 */
export const AMS_STYLE_NS = '::ams::';

const HIDE_STYLE_ID = 'ams-qiankun-chrome-hide';

const HIDE_CSS = `
qiankun-head,
.subapp-container meta,
.subapp-container title,
.subapp-container link[rel="icon"] {
  display: none !important;
  height: 0 !important;
  width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  visibility: hidden !important;
  pointer-events: none !important;
  font-size: 0 !important;
  line-height: 0 !important;
}
.subapp-container > [data-qiankun] {
  font-size: 0;
  line-height: 0;
}
.subapp-container > [data-qiankun] > #app {
  font-size: 14px;
  line-height: normal;
}
.app-content.el-main,
.subapp-container .el-main {
  --el-main-padding: 0 !important;
  padding: 0 !important;
}
`;

function injectHideStyle() {
  if (typeof document === 'undefined' || document.getElementById(HIDE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIDE_STYLE_ID;
  style.textContent = HIDE_CSS;
  document.head.appendChild(style);
}

function neutralizeHead(head) {
  head.setAttribute('hidden', '');
  head.setAttribute('aria-hidden', 'true');
  head.style.setProperty('display', 'none', 'important');
  head.style.setProperty('height', '0', 'important');
  head.style.setProperty('overflow', 'hidden', 'important');
  head.style.setProperty('position', 'absolute', 'important');
  Array.from(head.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag !== 'STYLE' && tag !== 'LINK' && tag !== 'SCRIPT') {
      node.remove();
    }
  });
}

function cleanWrapper(wrapper) {
  Array.from(wrapper.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === 'QIANKUN-HEAD') {
      neutralizeHead(node);
      return;
    }
    if (tag === 'STYLE' || tag === 'LINK' || tag === 'SCRIPT') return;
    if (node.id === 'app') return;
    node.remove();
  });
}

export function namespaceExistingViteStyles(owner = 'host') {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('style[data-vite-dev-id], link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    const id = el.getAttribute('data-vite-dev-id') || '';
    if (!id || id.includes(AMS_STYLE_NS)) return;
    const tagged = el.getAttribute('data-ams-style-app') || owner;
    el.setAttribute('data-vite-dev-id', `${id}${AMS_STYLE_NS}${tagged}`);
    if (!el.getAttribute('data-ams-style-app')) {
      el.setAttribute('data-ams-style-app', tagged);
    }
  });
}

export function hideQiankunChrome(root = document) {
  injectHideStyle();
  const run = () => {
    root.querySelectorAll('qiankun-head').forEach(neutralizeHead);
    root.querySelectorAll('#subapp-container [data-qiankun]').forEach(cleanWrapper);
  };
  run();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  }
}
