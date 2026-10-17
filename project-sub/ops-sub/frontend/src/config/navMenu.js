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
      { path: '/jobs', title: '任务队列', icon: 'List' },
      { path: '/deps', title: '依赖健康', icon: 'Connection' },
      { path: '/alerts', title: '告警中心', icon: 'Bell' },
      { path: '/audit', title: '操作审计', icon: 'Notebook' },
      { path: '/settings', title: '系统配置', icon: 'Setting', adminOnly: true },
    ],
  },
];

export const navMenus = navGroups.flatMap(group => group.items);
