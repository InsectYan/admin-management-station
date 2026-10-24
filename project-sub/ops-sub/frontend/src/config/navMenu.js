export const navGroups = [
  {
    title: '工程运维',
    items: [
      { path: '/projects', title: '项目信息', icon: 'Monitor' },
      { path: '/deploy-jobs', title: '部署任务', icon: 'Clock' },
    ],
  },
  {
    title: '内容运维',
    items: [
      { path: '/overview', title: '运维总览', icon: 'Odometer' },
      { path: '/board', title: '数据看板', icon: 'DataLine' },
      { path: '/jobs', title: '任务队列', icon: 'List' },
      { path: '/channels', title: '渠道账号', icon: 'Share' },
      { path: '/schedules', title: '发布排期', icon: 'Share' },
      { path: '/records', title: '发布记录', icon: 'Share' },
      { path: '/deps', title: '依赖健康', icon: 'Connection' },
      { path: '/alerts', title: '告警中心', icon: 'Bell' },
      { path: '/audit', title: '操作审计', icon: 'Notebook' },
      { path: '/compliance', title: '合规', icon: 'Warning' },
      { path: '/lineage', title: '版权溯源', icon: 'Notebook' },
      { path: '/usage', title: '用量', icon: 'Coin' },
      { path: '/settings', title: '系统配置', icon: 'Setting', adminOnly: true },
      { path: '/models', title: '模型与路由', icon: 'Cpu', adminOnly: true },
    ],
  },
];

export const navMenus = navGroups.flatMap(group => group.items);
