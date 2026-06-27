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
            meta: { title: '生成测试用例' },
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
            meta: { title: '测试用例管理' },
          },
          {
            path: 'runs/:runId',
            name: 'test-run-monitor',
            component: () => import('../views/TestRunMonitorPage.vue'),
            meta: { title: '执行监控' },
          },
          {
            path: 'runs/:runId/results',
            name: 'test-run-results',
            component: () => import('../views/TestResultAnalysisPage.vue'),
            meta: { title: '结果分析' },
          },
        ],
      },
    ],
  });
}
