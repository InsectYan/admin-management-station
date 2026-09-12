import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import qiankun from 'vite-plugin-qiankun';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 5103);
  const apiBase = env.VITE_API_BASE || 'http://localhost:5203/api';
  const apiOrigin = apiBase.replace(/\/api\/?$/, '');

  return {
    plugins: [
      vue(),
      qiankun('ops-app', { useDevMode: true }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port,
        clientPort: port,
      },
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || apiOrigin,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
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
