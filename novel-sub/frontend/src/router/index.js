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
          { path: '', redirect: 'novels' },
          {
            path: 'novels',
            name: 'novel-list',
            component: () => import('../views/NovelListPage.vue'),
          },
          {
            path: 'novels/new',
            name: 'novel-create',
            component: () => import('../views/NovelCreationPage.vue'),
          },
          {
            path: 'novels/:id',
            name: 'novel-detail',
            component: () => import('../views/NovelDetailPage.vue'),
          },
        ],
      },
    ],
  });
}
