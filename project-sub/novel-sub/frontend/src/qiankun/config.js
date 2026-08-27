export function getBasename() {
  if (window.__POWERED_BY_QIANKUN__) {
    return window.__novel_APP_BASENAME__ || '/media/novel';
  }
  return import.meta.env.VITE_BASENAME || '/';
}

export function setBasename(basename) {
  window.__novel_APP_BASENAME__ = basename;
}
