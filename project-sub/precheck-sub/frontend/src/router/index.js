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
          { path: '', redirect: '/runtimes' },
          { path: 'runtimes', component: () => import('../views/RuntimePage.vue') },
          { path: 'workflows', component: () => import('../views/WorkflowPage.vue') },
        ],
      },
    ],
  });
}
