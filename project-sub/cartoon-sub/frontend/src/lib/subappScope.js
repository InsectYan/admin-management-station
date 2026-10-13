import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

export function bindStandaloneScope() {
  if (qiankunWindow.__POWERED_BY_QIANKUN__) return () => {};
  document.title = '漫剧';
  return () => {};
}
