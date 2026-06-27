/**
 * 子应用样式作用域：独立 dev 时标记 html；嵌入态依赖 #subapp-container 高度链。
 */
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

export const SUBAPP_ROOT_CLASS = 'testgen-sub-root';
export const SUBAPP_STANDALONE_HTML_CLASS = 'testgen-sub-standalone';

export function isEmbeddedMode() {
  return !!qiankunWindow.__POWERED_BY_QIANKUN__;
}

/** @returns {() => void} */
export function bindStandaloneScope() {
  if (typeof document === 'undefined' || isEmbeddedMode()) {
    return () => {};
  }
  document.documentElement.classList.add(SUBAPP_STANDALONE_HTML_CLASS);
  return () => {
    document.documentElement.classList.remove(SUBAPP_STANDALONE_HTML_CLASS);
  };
}
