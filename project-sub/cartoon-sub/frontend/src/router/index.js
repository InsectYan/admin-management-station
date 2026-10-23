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
          { path: 'templates', component: () => import('../views/TemplateListPage.vue') },
          { path: 'templates/:id', component: () => import('../views/TemplateDetailPage.vue') },
          { path: 'pipelines', component: () => import('../views/PipelinePage.vue') },
          { path: 'pipelines/:contentType', component: () => import('../views/PipelinePage.vue') },
          { path: 'agents', component: () => import('../views/AgentPage.vue') },
          { path: 'rules', component: () => import('../views/RulePage.vue') },
          { path: 'batches', name: 'batches', component: () => import('../views/LibraryPage.vue') },
          { path: 'assets/:kind', name: 'assets', component: () => import('../views/LibraryPage.vue') },
          { path: 'reviews', name: 'reviews', component: () => import('../views/LibraryPage.vue') },
          { path: 'reviews/:id', component: () => import('../views/ReviewDetailPage.vue') },
          { path: 'versions', name: 'versions', component: () => import('../views/LibraryPage.vue') },
          { path: 'exports', name: 'exports', component: () => import('../views/LibraryPage.vue') },
          { path: 'projects/:id/tasks/:taskId', name: 'workbench', component: () => import('../views/WorkbenchPage.vue') },
          { path: 'projects/:id/edit', component: () => import('../views/OpenWorkbench.vue'), meta: { workbenchNode: 'compose' } },
          { path: 'projects/:id/work', component: () => import('../views/OpenWorkbench.vue'), meta: { workbenchNode: 'storyboard' } },
          { path: 'projects/:id/shots/:shotId/generate', component: () => import('../views/OpenWorkbench.vue'), meta: { workbenchNode: 'generate' } },
          { path: 'projects/:id/shots/:shotId/outputs', component: () => import('../views/OpenWorkbench.vue'), meta: { workbenchNode: 'preview' } },
          { path: 'projects/:id', component: () => import('../views/ProjectOverviewPage.vue') },
        ],
      },
    ],
  });
}
