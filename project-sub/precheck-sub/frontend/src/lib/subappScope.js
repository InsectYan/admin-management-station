import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

export const SUBAPP_STANDALONE_HTML_CLASS = 'precheck-sub-standalone';

export function bindStandaloneScope() {
  if (qiankunWindow.__POWERED_BY_QIANKUN__) {
    document.documentElement.classList.remove(SUBAPP_STANDALONE_HTML_CLASS);
    return () => {};
  }
  document.documentElement.classList.add(SUBAPP_STANDALONE_HTML_CLASS);
  document.title = '预检';
  return () => document.documentElement.classList.remove(SUBAPP_STANDALONE_HTML_CLASS);
}
