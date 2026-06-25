import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../components/MainLayout.vue';

export function createAppRouter(basename) {
  return createRouter({
    history: createWebHistory(basename),
    routes: [
      {
        path: '/',
        component: MainLayout,
        children: [
          { path: '', redirect: 'scope' },
          {
            path: 'scope',
            name: 'test-scope',
            component: () => import('../views/TestScopePage.vue'),
            meta: { title: '测试范围配置' },
          },
          {
            path: 'jobs/:id',
            name: 'generation-progress',
            component: () => import('../views/GenerationProgressPage.vue'),
            meta: { title: '生成进度' },
          },
          {
            path: 'suite',
            name: 'test-suite',
            component: () => import('../views/TestSuitePage.vue'),
            meta: { title: '用例管理' },
          },
        ],
      },
    ],
  });
}
