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

          // ── 项目管理 ──
          {
            path: 'projects',
            name: 'project-list',
            component: () => import('../views/projects/ProjectListPage.vue'),
            meta: { title: '项目管理', group: 'project' },
          },
          {
            path: 'projects/new',
            name: 'project-new',
            component: () => import('../views/projects/ProjectFormPage.vue'),
            meta: { title: '新建项目', group: 'project', hideInNav: true },
          },
          {
            path: 'projects/:projectCode/edit',
            name: 'project-edit',
            component: () => import('../views/projects/ProjectFormPage.vue'),
            meta: { title: '编辑项目', group: 'project', hideInNav: true },
          },
          {
            path: 'projects/:projectCode',
            component: () => import('../views/projects/ProjectDetailLayout.vue'),
            meta: { title: '项目详情', group: 'project', hideInNav: true },
            children: [
              {
                path: '',
                name: 'project-detail',
                component: () => import('../views/projects/ProjectOverviewPage.vue'),
                meta: { title: '项目概览', group: 'project' },
              },
              {
                path: 'environments',
                name: 'project-environments',
                component: () => import('../views/projects/ProjectEnvironmentsPage.vue'),
                meta: { title: '环境配置', group: 'project' },
              },
              {
                path: 'variables',
                name: 'project-variables',
                component: () => import('../views/projects/ProjectVariablesPage.vue'),
                meta: { title: '全局变量', group: 'project' },
              },
              {
                path: 'monitoring',
                name: 'project-monitoring',
                component: () => import('../views/projects/ProjectMonitoringPage.vue'),
                meta: { title: '环境监控', group: 'project' },
              },
              {
                path: 'sync',
                name: 'project-sync',
                component: () => import('../views/projects/ProjectSyncPage.vue'),
                meta: { title: '环境同步', group: 'project' },
              },
            ],
          },

          // ── 测试用例生成 ──
          {
            path: 'testgen/scope',
            name: 'test-scope',
            component: () => import('../views/TestScopePage.vue'),
            meta: { title: '生成配置', group: 'testgen' },
          },
          { path: 'scope', redirect: '/testgen/scope' },
          {
            path: 'testgen/items',
            name: 'test-suite',
            component: () => import('../views/fitness/assets/FitnessItemsPage.vue'),
            meta: { title: '用例库', group: 'testgen' },
          },
          { path: 'suite', redirect: '/testgen/items' },
          {
            path: 'jobs/:id',
            name: 'generation-progress',
            component: () => import('../views/GenerationProgressPage.vue'),
            meta: { title: '生成进度', group: 'testgen', hideInNav: true },
          },

          // ── 配置管理 ──
          {
            path: 'config/templates',
            name: 'config-templates',
            component: () => import('../views/config/TemplateManagePage.vue'),
            meta: { title: '模板管理', group: 'config' },
          },

          // ── 通用执行监控（旧链路，保留兼容） ──
          {
            path: 'runs/:runId',
            name: 'test-run-monitor',
            component: () => import('../views/TestRunMonitorPage.vue'),
            meta: { title: '执行监控', hideInNav: true },
          },
          {
            path: 'runs/:runId/results',
            name: 'test-run-results',
            component: () => import('../views/TestResultAnalysisPage.vue'),
            meta: { title: '结果分析', hideInNav: true },
          },

          // ── Fitness 测试体系 ──
          { path: 'fitness', redirect: '/fitness/dashboard' },
          {
            path: 'fitness/dashboard',
            name: 'fitness-dashboard',
            component: () => import('../views/fitness/dashboard/FitnessDashboardPage.vue'),
            meta: { title: '发版仪表盘', group: 'fitness' },
          },

          // 测试资产
          {
            path: 'fitness/assets',
            redirect: '/testgen/items',
            meta: { group: 'fitness' },
          },
          {
            path: 'fitness/assets/items',
            redirect: to => ({ path: '/testgen/items', query: to.query }),
          },
          {
            path: 'fitness/assets/items/:itemId',
            component: () => import('../views/fitness/assets/FitnessItemLayout.vue'),
            meta: { title: '测试项详情', group: 'fitness', hideInNav: true },
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

          // 洞察分析
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

          // 测试计划
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
            meta: { title: '完成报告', group: 'fitness', hideInNav: true },
          },
          {
            path: 'fitness/plans/:id',
            name: 'fitness-plan-detail',
            component: () => import('../views/fitness/plans/FitnessPlanDetailPage.vue'),
            meta: { title: '计划详情', group: 'fitness', hideInNav: true },
          },

          // 执行层
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
            meta: { title: '运行控制台', group: 'fitness', hideInNav: true },
          },

          // 专题视图
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

          // 系统设置
          {
            path: 'fitness/settings/enums',
            name: 'fitness-settings',
            component: () => import('../views/fitness/settings/FitnessSettingsPage.vue'),
            meta: { title: '枚举配置', group: 'config' },
          },
        ],
      },
    ],
  });
}
