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
            meta: { title: '项目信息' },
          },
          {
            path: 'projects/new',
            name: 'ops-create',
            component: () => import('../views/OpsProjectCreatePage.vue'),
            meta: { title: '新建项目' },
          },
          {
            path: 'projects/:id/edit',
            name: 'ops-edit',
            component: () => import('../views/OpsProjectDetailPage.vue'),
            meta: { title: '编辑项目', mode: 'edit' },
          },
          {
            path: 'projects/:id',
            name: 'ops-detail',
            component: () => import('../views/OpsProjectDetailPage.vue'),
            meta: { title: '项目详情', mode: 'view' },
          },
        ],
      },
    ],
  });
}
