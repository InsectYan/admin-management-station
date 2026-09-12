export function getBasename() {
  if (window.__POWERED_BY_QIANKUN__) {
    return window.__ops_APP_BASENAME__ || '/media/ops';
  }
  return import.meta.env.VITE_BASENAME || '/';
}

export function setBasename(basename) {
  window.__ops_APP_BASENAME__ = basename;
}
