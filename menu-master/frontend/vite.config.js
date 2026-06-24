import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 5173);
  const apiBase = env.VITE_API_BASE || 'http://localhost:7001/api';
  const apiOrigin = apiBase.replace(/\/api\/?$/, '');

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
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
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
          },
        },
      },
    },
  };
});
