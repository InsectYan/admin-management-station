import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../components/MainLayout.vue';
import { getAccessToken, getCachedUser, loginUrl } from '../lib/amsAuth.js';

export function createAppRouter(basename) {
  const router = createRouter({
    history: createWebHistory(basename),
    routes: [
      {
        path: '/',
        component: MainLayout,
        children: [
          { path: '', redirect: 'projects' },
          {
            path: 'overview',
            name: 'ops-overview',
            component: () => import('../views/OpsOverviewPage.vue'),
            meta: { title: '运维总览' },
          },
          {
            path: 'jobs/:bizApp/:externalId',
            name: 'ops-job-detail',
            component: () => import('../views/OpsJobDetailPage.vue'),
            meta: { title: '失败诊断' },
          },
          {
            path: 'jobs',
            name: 'ops-jobs',
            component: () => import('../views/OpsJobsPage.vue'),
            meta: { title: '任务队列' },
          },
          {
            path: 'deps',
            name: 'ops-deps',
            component: () => import('../views/OpsDepsPage.vue'),
            meta: { title: '依赖健康' },
          },
          {
            path: 'alerts',
            name: 'ops-alerts',
            component: () => import('../views/OpsAlertsPage.vue'),
            meta: { title: '告警中心' },
          },
          {
            path: 'audit',
            name: 'ops-audit',
            component: () => import('../views/OpsAuditPage.vue'),
            meta: { title: '操作审计' },
          },
          {
            path: 'settings',
            name: 'ops-settings',
            component: () => import('../views/OpsSettingsPage.vue'),
            meta: { title: '系统配置', admin: true },
          },
          {
            path: 'deploy-jobs',
            name: 'ops-deploy-jobs',
            component: () => import('../views/OpsDeployJobsPage.vue'),
            meta: { title: '部署任务' },
          },
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
            path: 'projects/:id/deploy/:jobId',
            name: 'ops-deploy-log',
            component: () => import('../views/OpsDeployLogPage.vue'),
            meta: { title: '部署日志' },
          },
          {
            path: 'projects/:id/deploy-logs',
            name: 'ops-deploy-history',
            component: () => import('../views/OpsDeployHistoryPage.vue'),
            meta: { title: '部署历史' },
          },
          {
            path: 'projects/:id/deploy',
            name: 'ops-deploy',
            component: () => import('../views/OpsDeployPage.vue'),
            meta: { title: '部署' },
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

  router.beforeEach((to) => {
    if (to.meta.admin && getCachedUser()?.role !== 'admin') return { name: 'ops-overview' };
    if (getAccessToken()) return true;
    if (import.meta.env.DEV && import.meta.env.VITE_OPS_AUTH_OPTIONAL === '1') return true;
    window.location.assign(loginUrl(window.location.origin + basename + to.fullPath));
    return false;
  });
  return router;
}
