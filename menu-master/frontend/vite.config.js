import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 5100);
  const apiBase = env.VITE_API_BASE || 'http://localhost:5200/api';
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
        '/subapps/novel-app': {
          target: env.VITE_SUBAPP_NOVEL_PROXY || 'http://127.0.0.1:5101',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/subapps\/novel-app\/?/, '/'),
        },
        '/subapps/testgen-app': {
          target: env.VITE_SUBAPP_TESTGEN_PROXY || 'http://127.0.0.1:5102',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/subapps\/testgen-app\/?/, '/'),
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
