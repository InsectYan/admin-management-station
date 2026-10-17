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
          { path: 'projects/:id/work', component: () => import('../views/ProjectDetailPage.vue') },
          { path: 'projects/:id/shots/:shotId/generate', component: () => import('../views/ShotGeneratePage.vue') },
          { path: 'projects/:id/shots/:shotId/outputs', component: () => import('../views/ShotOutputsPage.vue') },
          { path: 'projects/:id', component: () => import('../views/ProjectOverviewPage.vue') },
        ],
      },
    ],
  });
}
