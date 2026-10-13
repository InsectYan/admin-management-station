export function getBasename() {
  if (window.__POWERED_BY_QIANKUN__) return window.__precheck_APP_BASENAME__ || '/media/precheck';
  return '/media/precheck';
}
export function setBasename(basename) {
  window.__precheck_APP_BASENAME__ = basename;
}
