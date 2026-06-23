export function getBasename() {
  if (window.__POWERED_BY_QIANKUN__) {
    return window.__NOVEL_APP_BASENAME__ || '/media/novel';
  }
  return import.meta.env.VITE_BASENAME || '/';
}

export function setBasename(basename) {
  window.__NOVEL_APP_BASENAME__ = basename;
}
