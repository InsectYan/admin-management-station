import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {
  renderWithQiankun,
  qiankunWindow,
} from 'vite-plugin-qiankun/dist/helper';
import App from './App.jsx';
import { setBasename } from './qiankun/config.js';

let root = null;

function render(props = {}) {
  const container = props.container
    ? props.container.querySelector('#root')
    : document.getElementById('root');
  const basename = props.basename || '/media/novel';
  setBasename(basename);

  root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ConfigProvider locale={zhCN}>
        <App basename={basename} />
      </ConfigProvider>
    </React.StrictMode>,
  );
}

renderWithQiankun({
  bootstrap() {
    console.info('[novel-sub] bootstrap');
  },
  mount(props) {
    console.info('[novel-sub] mount', props);
    render(props);
  },
  unmount() {
    console.info('[novel-sub] unmount');
    root?.unmount();
    root = null;
  },
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render({ basename: '/media/novel' });
}
