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

          // ── Fitness 测试体系（多级路由） ──
          { path: 'fitness', redirect: '/fitness/dashboard' },
          {
            path: 'fitness/dashboard',
            name: 'fitness-dashboard',
            component: () => import('../views/fitness/dashboard/FitnessDashboardPage.vue'),
            meta: { title: '发版仪表盘', group: 'fitness' },
          },
          {
            path: 'fitness/assets',
            redirect: '/fitness/assets/items',
            meta: { group: 'fitness' },
          },
          {
            path: 'fitness/assets/items',
            name: 'fitness-items',
            component: () => import('../views/fitness/assets/FitnessItemsPage.vue'),
            meta: { title: '测试项库', group: 'fitness' },
          },
          {
            path: 'fitness/assets/items/:itemId',
            component: () => import('../views/fitness/assets/FitnessItemLayout.vue'),
            meta: { title: '测试项详情', group: 'fitness' },
            children: [
              {
                path: '',
                name: 'fitness-item-detail',
                component: () => import('../views/fitness/assets/FitnessItemDetailPage.vue'),
                meta: { title: '测试项详情', group: 'fitness' },
              },
              {
                path: 'config',
                name: 'fitness-item-config',
                component: () => import('../views/fitness/execution/FitnessRunConfigPage.vue'),
                meta: { title: '方案配置', group: 'fitness' },
              },
              {
                path: 'launch',
                name: 'fitness-item-launch',
                component: () => import('../views/fitness/execution/FitnessRunLaunchPage.vue'),
                meta: { title: '执行确认', group: 'fitness' },
              },
              {
                path: 'history',
                name: 'fitness-item-history',
                component: () => import('../views/fitness/assets/FitnessItemHistoryTab.vue'),
                meta: { title: '执行历史', group: 'fitness' },
              },
            ],
          },
          {
            path: 'fitness/assets/browse',
            name: 'fitness-browse',
            component: () => import('../views/fitness/assets/FitnessBrowsePage.vue'),
            meta: { title: '分类浏览', group: 'fitness' },
          },
          {
            path: 'fitness/assets/schemes',
            name: 'fitness-schemes',
            component: () => import('../views/fitness/assets/FitnessSchemesPage.vue'),
            meta: { title: '方案百科', group: 'fitness' },
          },
          {
            path: 'fitness/insights/metrics',
            component: () => import('../views/fitness/insights/FitnessMetricsLayout.vue'),
            meta: { group: 'fitness' },
            children: [
              { path: '', redirect: { name: 'fitness-metrics-tab', params: { tab: 'dimensions' } } },
              {
                path: ':tab',
                name: 'fitness-metrics-tab',
                component: () => import('../views/fitness/insights/FitnessMetricsTabPage.vue'),
                meta: { title: '指标中心', group: 'fitness' },
              },
            ],
          },
          {
            path: 'fitness/insights/analysis',
            component: () => import('../views/fitness/insights/FitnessAnalysisLayout.vue'),
            meta: { group: 'fitness' },
            children: [
              { path: '', redirect: { name: 'fitness-analysis-tab', params: { tab: 'readiness' } } },
              {
                path: ':tab',
                name: 'fitness-analysis-tab',
                component: () => import('../views/fitness/insights/FitnessAnalysisTabPage.vue'),
                meta: { title: '分析中心', group: 'fitness' },
              },
            ],
          },
          {
            path: 'fitness/insights/risks',
            name: 'fitness-risks',
            component: () => import('../views/fitness/insights/FitnessRisksPage.vue'),
            meta: { title: '风险中心', group: 'fitness' },
          },
          {
            path: 'fitness/plans',
            name: 'fitness-plans',
            component: () => import('../views/fitness/plans/FitnessPlansPage.vue'),
            meta: { title: '测试计划', group: 'fitness' },
          },
          {
            path: 'fitness/plans/new',
            name: 'fitness-plan-new',
            component: () => import('../views/fitness/plans/FitnessPlanWizardPage.vue'),
            meta: { title: '计划向导', group: 'fitness' },
          },
          {
            path: 'fitness/plans/:id/report',
            name: 'fitness-plan-report',
            component: () => import('../views/fitness/plans/FitnessPlanReportPage.vue'),
            meta: { title: '完成报告', group: 'fitness' },
          },
          {
            path: 'fitness/plans/:id',
            name: 'fitness-plan-detail',
            component: () => import('../views/fitness/plans/FitnessPlanDetailPage.vue'),
            meta: { title: '计划详情', group: 'fitness' },
          },
          {
            path: 'fitness/execution/environments',
            name: 'fitness-envs',
            component: () => import('../views/fitness/execution/FitnessEnvironmentsPage.vue'),
            meta: { title: '环境配置', group: 'fitness' },
          },
          {
            path: 'fitness/execution/samples',
            name: 'fitness-samples',
            component: () => import('../views/fitness/execution/FitnessSamplesPage.vue'),
            meta: { title: '样本集', group: 'fitness' },
          },
          {
            path: 'fitness/execution/center',
            name: 'fitness-run-center',
            component: () => import('../views/fitness/execution/FitnessRunCenterPage.vue'),
            meta: { title: '执行中心', group: 'fitness' },
          },
          {
            path: 'fitness/execution/run/:itemId/config/:schemeType',
            redirect: to => `/fitness/assets/items/${encodeURIComponent(to.params.itemId)}/config`,
          },
          {
            path: 'fitness/execution/run/:itemId/launch',
            redirect: to => `/fitness/assets/items/${encodeURIComponent(to.params.itemId)}/launch`,
          },
          {
            path: 'fitness/execution/runs/:runId',
            name: 'fitness-run-console',
            component: () => import('../views/fitness/execution/FitnessRunConsolePage.vue'),
            meta: { title: '运行控制台', group: 'fitness' },
          },
          {
            path: 'fitness/settings/enums',
            name: 'fitness-settings',
            component: () => import('../views/fitness/settings/FitnessSettingsPage.vue'),
            meta: { title: '枚举配置', group: 'fitness' },
          },
          {
            path: 'fitness/topics/stations',
            name: 'fitness-topic-stations',
            component: () => import('../views/fitness/topics/FitnessTopicStationsPage.vue'),
            meta: { title: '六站专题', group: 'fitness' },
          },
          {
            path: 'fitness/topics/business',
            name: 'fitness-topic-business',
            component: () => import('../views/fitness/topics/FitnessTopicBusinessPage.vue'),
            meta: { title: '业务专题', group: 'fitness' },
          },
          {
            path: 'fitness/topics/observability',
            name: 'fitness-topic-observability',
            component: () => import('../views/fitness/topics/FitnessTopicObservabilityPage.vue'),
            meta: { title: '可观测性专题', group: 'fitness' },
          },
        ],
      },
    ],
  });
}
