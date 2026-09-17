import { createApp } from 'vue';
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
import { createQiankunStyleKeeper } from './lib/qiankunStyleKeeper.js';
import { consumeHandedToken } from './lib/amsAuth.js';
import './App.css';
import './styles/variables.css';
import './styles/element-override.css';
import './styles/forest-motion.css';
import './styles/landscapes.css';

let app = null;
let router = null;
let unbindStandaloneScope = null;
const styleKeeper = createQiankunStyleKeeper({
  appName: 'ops-app',
  pathHint: 'ops-sub',
  rootClass: 'ops-sub-root',
});

function render(props = {}) {
  consumeHandedToken();
  unbindStandaloneScope?.();
  unbindStandaloneScope = bindStandaloneScope();
  const container = props.container
    ? props.container.querySelector('#app')
    : document.getElementById('app');
  const basename = props.basename || '/media/ops';
  setBasename(basename);

  router = createAppRouter(basename);
  app = createApp(App);
  app.use(ElementPlus, { locale: zhCn });
  app.use(router);
  app.mount(container);
}

renderWithQiankun({
  bootstrap() {
    console.info('[ops-sub] bootstrap');
  },
  mount(props) {
    console.info('[ops-sub] mount', props);
    styleKeeper.restore();
    render(props);
    styleKeeper.claim();
  },
  unmount() {
    console.info('[ops-sub] unmount');
    styleKeeper.save();
    app?.unmount();
    app = null;
    router = null;
    unbindStandaloneScope?.();
    unbindStandaloneScope = null;
  },
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render({ basename: '/media/ops' });
}
