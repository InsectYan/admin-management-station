import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 5174);
  const apiBase = env.VITE_API_BASE || 'http://localhost:7002/api';
  const apiOrigin = apiBase.replace(/\/api\/?$/, '');

  return {
    plugins: [
      react(),
      qiankun('novel-app', { useDevMode: true }),
    ],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || apiOrigin,
          changeOrigin: true,
        },
        '/agent-api': {
          target: env.VITE_AGENT_API_BASE || 'http://localhost:7003',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/agent-api/, ''),
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
