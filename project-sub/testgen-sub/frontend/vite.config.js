import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import qiankun from 'vite-plugin-qiankun';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 5175);
  const apiBase = env.VITE_API_BASE || 'http://localhost:7003/api';
  const apiOrigin = apiBase.replace(/\/api\/?$/, '');

  return {
    plugins: [
      vue(),
      qiankun('testgen-app', { useDevMode: true }),
    ],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
      // 嵌入主应用（5173）时，HMR WebSocket 须连子应用端口，否则会整页刷新或无效
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port,
        clientPort: port,
      },
      // Docker / Windows 卷挂载时原生 fs 事件不可靠
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || apiOrigin,
          changeOrigin: true,
        },
      },
    },
    base: env.VITE_BASE || '/',
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
