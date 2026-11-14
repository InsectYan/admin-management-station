import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import 'element-plus/dist/index.css';
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';
import App from './App.vue';
import { createAppRouter } from './router';
import { setBasename } from './qiankun/config.js';
import { bindStandaloneScope } from './lib/subappScope.js';
import { consumeHandedToken } from './lib/amsAuth.js';
import './styles/base.css';
import './styles/shell.css';
import './App.css';
import { installFitTable } from './lib/fitTable.js';

let app = null;
let router = null;
let unbind = null;

function limitTooltipWidth() {
  if (document.getElementById('cartoon-tooltip-limit')) return;
  const style = document.createElement('style');
  style.id = 'cartoon-tooltip-limit';
  style.textContent = '.el-popper[role="tooltip"]{max-width:300px !important;box-sizing:border-box;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.5}';
  document.head.appendChild(style);
}

function render(props = {}) {
  limitTooltipWidth();
  consumeHandedToken();
  unbind?.();
  unbind = bindStandaloneScope();
  const container = props.container
    ? props.container.querySelector('#app')
    : document.getElementById('app');
  const basename = props.basename || '/media/cartoon';
  setBasename(basename);
  router = createAppRouter(basename);
  app = createApp(App);
  app.use(createPinia());
  app.use(ElementPlus, { locale: zhCn });
  installFitTable(app);
  app.use(router);
  app.mount(container);
}

renderWithQiankun({
  bootstrap() {},
  mount(props) { render(props); },
  unmount() {
    app?.unmount();
    app = null;
    router = null;
    unbind?.();
    unbind = null;
  },
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render({ basename: '/media/cartoon' });
}
