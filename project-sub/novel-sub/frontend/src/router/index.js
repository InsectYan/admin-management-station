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
            meta: { title: '小说列表' },
          },
          {
            path: 'novels/create',
            name: 'novel-create',
            component: () => import('../views/NovelCreatePage.vue'),
            meta: { title: '新建小说' },
          },
          {
            path: 'novels/:id/qa',
            name: 'novel-qa',
            component: () => import('../views/NovelQaPage.vue'),
            meta: { title: '验收核检' },
          },
          {
            path: 'novels/:id',
            name: 'novel-detail',
            component: () => import('../views/NovelDetailPage.vue'),
            meta: { title: '小说详情' },
          },
        ],
      },
    ],
  });
}
