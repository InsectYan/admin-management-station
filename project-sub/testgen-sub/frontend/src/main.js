import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import 'element-plus/dist/index.css';
import {
  renderWithQiankun,
  qiankunWindow,
} from 'vite-plugin-qiankun/dist/helper';
import App from './App.vue';
import { createAppRouter } from './router';
import { setBasename } from './qiankun/config.js';
import { bindStandaloneScope } from './lib/subappScope.js';
import './App.css';

let app = null;
let router = null;
let pinia = null;
let unbindStandaloneScope = null;

function render(props = {}) {
  unbindStandaloneScope?.();
  unbindStandaloneScope = bindStandaloneScope();
  const container = props.container
    ? props.container.querySelector('#app')
    : document.getElementById('app');
  const basename = props.basename || '/media/testgen';
  setBasename(basename);

  pinia = createPinia();
  router = createAppRouter(basename);
  app = createApp(App);
  app.use(pinia);
  app.use(ElementPlus, { locale: zhCn });
  app.use(router);
  app.mount(container);
}

renderWithQiankun({
  bootstrap() {
    console.info('[testgen-sub] bootstrap');
  },
  mount(props) {
    console.info('[testgen-sub] mount', props);
    render(props);
  },
  unmount() {
    console.info('[testgen-sub] unmount');
    app?.unmount();
    app = null;
    router = null;
    pinia = null;
    unbindStandaloneScope?.();
    unbindStandaloneScope = null;
  },
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render({ basename: '/media/testgen' });
}
