/** 侧栏 / 顶栏导航树（与 router 路径保持一致） */
export const navMenus = [
  {
    type: 'item',
    path: '/projects',
    title: '项目管理',
    icon: 'FolderOpened',
  },
  {
    type: 'submenu',
    index: 'testgen',
    title: '测试用例',
    icon: 'Aim',
    children: [
      {
        path: '/testgen/scope',
        title: '生成配置',
        activePrefix: '/testgen/scope',
        activeAliases: [ '/scope', '/jobs' ],
      },
      {
        path: '/testgen/items',
        title: '用例库',
        activePrefix: '/testgen/items',
        activeAliases: [ '/suite', '/fitness/assets/items', '/runs' ],
      },
    ],
  },
  {
    type: 'submenu',
    index: 'config',
    title: '配置管理',
    icon: 'Setting',
    children: [
      { path: '/config/templates', title: '模板管理', activePrefix: '/config' },
      { path: '/fitness/settings/enums', title: '枚举配置', activePrefix: '/fitness/settings' },
    ],
  },
  {
    type: 'submenu',
    index: 'fitness',
    title: 'Fitness 测试体系',
    icon: 'DataAnalysis',
    children: [
      { path: '/fitness/dashboard', title: '发版仪表盘', activePrefix: '/fitness/dashboard' },
      {
        type: 'submenu',
        index: 'fitness-assets',
        title: '测试资产',
        children: [
          { path: '/fitness/assets/browse', title: '分类浏览', activePrefix: '/fitness/assets/browse' },
          { path: '/fitness/assets/schemes', title: '方案百科', activePrefix: '/fitness/assets/schemes' },
        ],
      },
      {
        type: 'submenu',
        index: 'fitness-insights',
        title: '洞察分析',
        children: [
          {
            path: '/fitness/insights/metrics/dimensions',
            title: '指标中心',
            activePrefix: '/fitness/insights/metrics',
          },
          {
            path: '/fitness/insights/analysis/readiness',
            title: '分析中心',
            activePrefix: '/fitness/insights/analysis',
          },
          { path: '/fitness/insights/risks', title: '风险中心', activePrefix: '/fitness/insights/risks' },
        ],
      },
      {
        type: 'submenu',
        index: 'fitness-plans',
        title: '测试计划',
        children: [
          { path: '/fitness/plans', title: '计划列表', activePrefix: '/fitness/plans' },
          { path: '/fitness/plans/new', title: '计划向导', activePrefix: '/fitness/plans/new' },
        ],
      },
      {
        type: 'submenu',
        index: 'fitness-exec',
        title: '执行层',
        children: [
          {
            path: '/fitness/execution/environments',
            title: '环境配置',
            activePrefix: '/fitness/execution/environments',
          },
          { path: '/fitness/execution/samples', title: '样本集', activePrefix: '/fitness/execution/samples' },
          {
            path: '/fitness/execution/center',
            title: '执行中心',
            activePrefix: '/fitness/execution/center',
            activeAliases: [ '/fitness/execution/runs' ],
          },
        ],
      },
      {
        type: 'submenu',
        index: 'fitness-topics',
        title: '专题视图',
        children: [
          { path: '/fitness/topics/stations', title: '六站专题', activePrefix: '/fitness/topics/stations' },
          { path: '/fitness/topics/business', title: '业务专题', activePrefix: '/fitness/topics/business' },
          {
            path: '/fitness/topics/observability',
            title: '可观测性专题',
            activePrefix: '/fitness/topics/observability',
          },
        ],
      },
    ],
  },
];
