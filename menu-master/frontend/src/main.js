import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import { getAccessToken, setSession, clearSession } from './lib/amsAuth.js';
import { fetchMe } from './services/authService.js';
import './App.css';

async function hydrateSession() {
  if (!getAccessToken()) return;
  try {
    const data = await fetchMe();
    if (data?.user) setSession({ user: data.user });
  } catch {
    clearSession();
  }
}

const app = createApp(App);
app.use(ElementPlus, { locale: zhCn });
app.use(router);

hydrateSession().finally(() => {
  app.mount('#app');
});
