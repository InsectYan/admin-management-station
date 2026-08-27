/**
 * Qiankun 会把子应用 <head> 换成自定义标签 qiankun-head 塞进容器。
 * 该标签不是真实 head，title/meta/空白节点会占布局。样式节点必须保留。
 */
const HIDE_STYLE_ID = 'ams-qiankun-chrome-hide';

const HIDE_CSS = `
qiankun-head {
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
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag !== 'STYLE' && tag !== 'LINK' && tag !== 'SCRIPT') {
      node.remove();
    }
  });
}

export function hideQiankunChrome(root = document) {
  injectHideStyle();
  root.querySelectorAll('qiankun-head').forEach(neutralizeHead);
}
