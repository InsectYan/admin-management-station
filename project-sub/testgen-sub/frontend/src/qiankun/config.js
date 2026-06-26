export function getBasename() {
  if (window.__POWERED_BY_QIANKUN__) {
    return window.__TESTGEN_APP_BASENAME__ || '/media/testgen';
  }
  return import.meta.env.VITE_BASENAME || '/';
}

export function setBasename(basename) {
  window.__TESTGEN_APP_BASENAME__ = basename;
}
