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
          { path: '', redirect: 'projects' },
          {
            path: 'projects',
            name: 'ops-list',
            component: () => import('../views/OpsProjectListPage.vue'),
            meta: { title: '项目列表' },
          },
          {
            path: 'projects/:id',
            name: 'ops-detail',
            component: () => import('../views/OpsProjectDetailPage.vue'),
            meta: { title: '项目详情' },
          },
        ],
      },
    ],
  });
}
