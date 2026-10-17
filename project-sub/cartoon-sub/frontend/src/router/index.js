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
          { path: '', redirect: '/projects' },
          { path: 'projects', component: () => import('../views/ProjectListPage.vue') },
          { path: 'projects/:id/edit', component: () => import('../views/ProjectEditPage.vue') },
          { path: 'projects/:id', component: () => import('../views/ProjectDetailPage.vue') },
        ],
      },
    ],
  });
}
