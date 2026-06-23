import { registerMicroApps, start } from 'qiankun';
import { buildActiveRule, buildBasename, resolveSubAppEntry } from './config.js';

let qiankunStarted = false;

export function registerSubApps(rootMenus) {
  const enabledMenus = (rootMenus || []).filter(menu => menu.status === 'enabled');

  registerMicroApps(
    enabledMenus.map(menu => ({
      name: menu.microapp_name,
      entry: resolveSubAppEntry(menu.microapp_name, menu.entry),
      container: '#subapp-container',
      activeRule: menu.active_rule || buildActiveRule(menu.route_prefix),
      props: {
        menuData: menu,
        basename: menu.basename || buildBasename(menu.route_prefix),
        subapp: menu.subapp,
      },
    })),
    {
      beforeLoad: app => console.info('[qiankun] beforeLoad', app.name),
      beforeMount: app => console.info('[qiankun] beforeMount', app.name),
      afterUnmount: app => console.info('[qiankun] afterUnmount', app.name),
    }
  );

  if (!qiankunStarted) {
    start({
      prefetch: true,
      sandbox: { strictStyleIsolation: false, experimentalStyleIsolation: true },
    });
    qiankunStarted = true;
  }
}
