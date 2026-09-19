'use strict';

/**
 * 运维项目配置 JSON 契约（导入 / 导出 / 模板共用）。
 * schema = ops-project/v1
 */

const { normalizeDeployConfig } = require('./deployProducts');

const SCHEMA_ID = 'ops-project/v1';
const TEMPLATE_VERSION = '1.0.0';

const PROJECT_TYPES = [ 'frontend', 'backend', 'fullstack', 'agent' ];
const PROJECT_STATUSES = [ 'draft', 'active', 'archived' ];
const NODE_TYPES = [ 'start', 'page', 'api', 'action', 'decision', 'end' ];
const NODE_SEVERITIES = [ 'risk', 'warning' ];
const EDGE_TYPES = [ 'next', 'success', 'fail', 'branch' ];
const TREE_NODE_TYPES = [ 'dir', 'file' ];

const FIELD_GUIDE = {
  schema: '固定值 ops-project/v1，导入时用于识别模板版本',
  version: '模板自身版本号，填写 1.0.0 即可',
  name: '项目名称（必填）',
  type: '项目类型：frontend | backend | fullstack | agent',
  description: '项目职责与范围说明',
  repo_url: 'GitHub HTTPS 地址（GitHub 部署必填），例如 https://github.com/org/repo.git',
  source_path: '本地部署时拷贝的宿主机路径；Agent 须能走到含 deploy/scripts/run.mjs 的仓库根，不要只指 .pi',
  status: 'draft（梳理中）| active（在维护）| archived（已归档）',
  directory_tree: '目录树。flow_key 只绑该节点真正参与的那一条流程；支撑目录留空，禁止绑 overview 冒充万能入口',
  routes: '前端/全栈路由。每条路由只绑一条 flow_key，进入流程只能打开对应分流程',
  flows: '必须含 key=overview（完整项目链路，每种分叉有节点和后续）。分流程按能力少拆、链画全，禁止为每种 type 再拆一张图',
  'flows[].nodes': '节点：id, name, type(start|page|api|action|decision|end)=业务形态；severity(可选 risk|warning)是独立标注，任何类型都能标；description=节点特点；risk_note=为何风险/警告及会导致什么问题',
  'flows[].edges': '连线：id, source, target, label, type(next|success|fail|branch)',
  extra_json: '排障反查表：message_types / shell_ops 或 api_ops / skills / errors / risks（风险仍须是图上红/橙节点）',
  deploy_config: '部署产品配置。product=generic|agentrun|…；code_source=local|github；git_branch 默认 main；git_tag 为发布标签（GitHub 源会在部署时自动创建并推送，无需手工打 tag）；agentrun.package_path 为仓库内相对包路径（GitHub 仅拉该目录）。GitHub Token 存在登录用户个人信息',
};

function emptyDirectoryNode() {
  return {
    name: '',
    type: 'dir',
    description: '',
    flow_key: '',
    children: [],
  };
}

function emptyRoute() {
  return {
    path: '',
    name: '',
    component: '',
    meta: { title: '', auth: false },
    flow_key: '',
    children: [],
  };
}

function emptyOverviewFlow() {
  return {
    key: 'overview',
    name: '项目总览',
    description: '概览整个项目的页面与模块关系',
    ref_path: '',
    nodes: [
      { id: 'start', name: '开始', type: 'start', description: '', x: 80, y: 160 },
      { id: 'n1', name: '功能入口', type: 'page', description: '从目录或路由进入对应分流程', x: 280, y: 160 },
      { id: 'end', name: '结束', type: 'end', description: '', x: 500, y: 160 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'n1', label: '', type: 'next' },
      { id: 'e2', source: 'n1', target: 'end', label: '完成', type: 'success' },
    ],
  };
}

function emptyFlow() {
  return emptyOverviewFlow();
}

function buildEmptyTemplate() {
  return {
    schema: SCHEMA_ID,
    version: TEMPLATE_VERSION,
    _guide: FIELD_GUIDE,
    name: '',
    type: 'frontend',
    description: '',
    repo_url: '',
    source_path: '',
    status: 'draft',
    directory_tree: [
      {
        name: 'src',
        type: 'dir',
        description: '源码根目录',
        children: [
          { name: 'views', type: 'dir', description: '页面', children: [] },
          { name: 'components', type: 'dir', description: '组件', children: [] },
          { name: 'main.js', type: 'file', description: '入口文件', children: [] },
        ],
      },
      {
        name: 'package.json',
        type: 'file',
        description: '依赖与脚本',
        children: [],
      },
    ],
    routes: [
      {
        path: '/',
        name: 'home',
        component: 'HomeView',
        meta: { title: '首页', auth: false },
        children: [],
      },
    ],
    flows: [ emptyFlow() ],
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTree(nodes) {
  return asArray(nodes).map((raw, index) => {
    const node = asObject(raw);
    const type = TREE_NODE_TYPES.includes(node.type) ? node.type : 'dir';
    return {
      name: String(node.name || `unnamed-${index + 1}`),
      type,
      description: String(node.description || ''),
      flow_key: String(node.flow_key || ''),
      children: type === 'dir' ? normalizeTree(node.children) : [],
    };
  });
}

function normalizeRoutes(nodes) {
  return asArray(nodes).map((raw, index) => {
    const node = asObject(raw);
    const meta = asObject(node.meta);
    return {
      path: String(node.path || ''),
      name: String(node.name || `route-${index + 1}`),
      component: String(node.component || ''),
      meta: {
        title: String(meta.title || ''),
        auth: Boolean(meta.auth),
      },
      flow_key: String(node.flow_key || ''),
      children: normalizeRoutes(node.children),
    };
  });
}

function normalizeNodes(nodes) {
  return asArray(nodes).map((raw, index) => {
    const node = asObject(raw);
    const legacyAlert = node.type === 'risk' || node.type === 'warning' ? node.type : '';
    const type = NODE_TYPES.includes(node.type) ? node.type : 'action';
    const severity = NODE_SEVERITIES.includes(node.severity)
      ? node.severity
      : (legacyAlert || '');
    const description = String(node.description || '');
    const riskNote = String(node.risk_note || node.risk || '') || (legacyAlert ? description : '');
    return {
      id: String(node.id || `n${index + 1}`),
      name: String(node.name || `节点${index + 1}`),
      type: NODE_TYPES.includes(type) ? type : 'action',
      severity,
      description,
      risk_note: riskNote,
      x: Number.isFinite(Number(node.x)) ? Number(node.x) : 120 + index * 160,
      y: Number.isFinite(Number(node.y)) ? Number(node.y) : 160,
    };
  });
}

function normalizeEdges(edges) {
  return asArray(edges).map((raw, index) => {
    const edge = asObject(raw);
    return {
      id: String(edge.id || `e${index + 1}`),
      source: String(edge.source || ''),
      target: String(edge.target || ''),
      label: String(edge.label || ''),
      type: EDGE_TYPES.includes(edge.type) ? edge.type : 'next',
    };
  }).filter(edge => edge.source && edge.target);
}

function normalizeFlows(flows) {
  const list = asArray(flows).map((raw, index) => {
    const flow = asObject(raw);
    return {
      key: String(flow.key || `flow-${index + 1}`),
      name: String(flow.name || `功能流程 ${index + 1}`),
      description: String(flow.description || ''),
      ref_path: String(flow.ref_path || ''),
      nodes: normalizeNodes(flow.nodes),
      edges: normalizeEdges(flow.edges),
    };
  });
  if (!list.length) return [ emptyOverviewFlow() ];
  if (!list.some(flow => flow.key === 'overview')) {
    list.unshift(emptyOverviewFlow());
  }
  return list;
}

function normalizeProjectPayload(raw) {
  const body = asObject(raw);
  const type = PROJECT_TYPES.includes(body.type) ? body.type : 'frontend';
  const status = PROJECT_STATUSES.includes(body.status) ? body.status : 'draft';
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('项目名称不能为空');
    err.status = 400;
    throw err;
  }
  return {
    name,
    project_type: type,
    description: String(body.description || ''),
    repo_url: String(body.repo_url || ''),
    source_path: String(body.source_path || ''),
    status,
    directory_tree: normalizeTree(body.directory_tree),
    routes: normalizeRoutes(body.routes),
    flows: normalizeFlows(body.flows),
    extra_json: asObject(body.extra_json),
    deploy_config: normalizeDeployConfig(body.deploy_config),
  };
}

function parseImportDocument(raw) {
  const body = asObject(raw);
  if (body.schema && body.schema !== SCHEMA_ID) {
    const err = new Error(`不支持的模板 schema：${body.schema}，期望 ${SCHEMA_ID}`);
    err.status = 400;
    throw err;
  }
  return normalizeProjectPayload(body);
}

function serializeExport(row) {
  return {
    schema: SCHEMA_ID,
    version: TEMPLATE_VERSION,
    _guide: FIELD_GUIDE,
    name: row.name,
    type: row.project_type,
    description: row.description || '',
    repo_url: row.repo_url || '',
    source_path: row.source_path || '',
    status: row.status,
    directory_tree: row.directory_tree || [],
    routes: row.routes || [],
    flows: row.flows || [],
    extra_json: row.extra_json || {},
    deploy_config: row.deploy_config || {},
    exported_at: new Date().toISOString(),
  };
}

function demoProjects() {
  return [
    {
      name: '小说创作平台前端',
      type: 'frontend',
      description: 'novel-sub 前端：列表、创建向导、详情与 AntV 关系图。用于演示运维梳理模板。',
      repo_url: '',
      source_path: 'admin-management-station/project-sub/novel-sub/frontend',
      status: 'active',
      directory_tree: [
        {
          name: 'frontend',
          type: 'dir',
          description: 'Vue 3 + Element Plus 子应用',
          children: [
            {
              name: 'src',
              type: 'dir',
              description: '',
              children: [
                { name: 'views', type: 'dir', description: '列表 / 创建 / 详情', children: [] },
                { name: 'components', type: 'dir', description: '布局与业务组件', children: [] },
                { name: 'services', type: 'dir', description: 'BFF 调用', children: [] },
                { name: 'main.js', type: 'file', description: 'Qiankun 生命周期', children: [] },
              ],
            },
            { name: 'package.json', type: 'file', description: '', children: [] },
          ],
        },
      ],
      routes: [
        { path: '/novels', name: 'novel-list', component: 'NovelListPage', meta: { title: '小说列表', auth: false }, flow_key: 'novel-list', children: [] },
        { path: '/novels/create', name: 'novel-create', component: 'NovelCreatePage', meta: { title: '新建小说', auth: false }, flow_key: 'create-novel', children: [] },
        { path: '/novels/:id', name: 'novel-detail', component: 'NovelDetailPage', meta: { title: '小说详情', auth: false }, flow_key: 'novel-detail', children: [] },
      ],
      flows: [
        {
          key: 'overview',
          name: '项目总览',
          description: '列表、创建向导、详情之间的整体关系',
          ref_path: '',
          nodes: [
            { id: 'start', name: '开始', type: 'start', description: '', x: 60, y: 180 },
            { id: 'list', name: '小说列表', type: 'page', description: '看板 / 表格', x: 240, y: 180 },
            { id: 'create', name: '新建小说', type: 'page', description: '五步向导', x: 440, y: 80 },
            { id: 'warn-auth', name: '需登录', type: 'action', severity: 'warning', description: '未开通账号不能进入创建向导的鉴权检查', risk_note: '未开通仍进创建向导会把草稿写到错误身份或匿名会话。', x: 440, y: 0 },
            { id: 'detail', name: '小说详情', type: 'page', description: '设定与关系图', x: 440, y: 280 },
            { id: 'end', name: '结束', type: 'end', description: '', x: 660, y: 180 },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'list', label: '', type: 'next' },
            { id: 'e2', source: 'list', target: 'create', label: '新建', type: 'next' },
            { id: 'e2w', source: 'list', target: 'warn-auth', label: '注意', type: 'branch' },
            { id: 'e3', source: 'list', target: 'detail', label: '打开', type: 'next' },
            { id: 'e4', source: 'create', target: 'end', label: '完成', type: 'success' },
            { id: 'e5', source: 'detail', target: 'end', label: '', type: 'success' },
          ],
        },
        {
          key: 'create-novel',
          name: '创建小说',
          description: '从列表进入向导，逐步补齐设定后回列表',
          nodes: [
            { id: 'start', name: '开始', type: 'start', description: '', x: 60, y: 180 },
            { id: 'list', name: '小说列表', type: 'page', description: '看板 / 表格双视图', x: 220, y: 180 },
            { id: 'wizard', name: '五步向导', type: 'page', description: '基础信息 → 世界观 → 人物 → 大纲 → 目录', x: 420, y: 180 },
            { id: 'save', name: '保存草稿 API', type: 'api', description: 'PUT /api/novels/:id', x: 620, y: 80 },
            { id: 'decide', name: '是否完成？', type: 'decision', description: '向导最后一步确认', x: 620, y: 280 },
            { id: 'fail', name: '保存失败', type: 'action', severity: 'risk', description: '草稿未写入或校验失败', risk_note: '失败当完成会让列表以为小说已保存，实际库中没有草稿。', x: 840, y: 320 },
            { id: 'done', name: '回到列表', type: 'end', description: '', x: 840, y: 180 },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'list', label: '', type: 'next' },
            { id: 'e2', source: 'list', target: 'wizard', label: '新建', type: 'next' },
            { id: 'e3', source: 'wizard', target: 'save', label: '每步保存', type: 'success' },
            { id: 'e4', source: 'wizard', target: 'decide', label: '提交', type: 'next' },
            { id: 'e5', source: 'decide', target: 'done', label: '完成', type: 'success' },
            { id: 'e6', source: 'decide', target: 'wizard', label: '继续编辑', type: 'branch' },
            { id: 'e7', source: 'decide', target: 'fail', label: '失败码', type: 'fail' },
          ],
        },
        {
          key: 'novel-list',
          name: '小说列表',
          description: '看板 / 表格浏览与筛选',
          ref_path: '/novels',
          nodes: [
            { id: 'start', name: '开始', type: 'start', description: '', x: 80, y: 160 },
            { id: 'list', name: '小说列表', type: 'page', description: '双视图', x: 280, y: 160 },
            { id: 'end', name: '结束', type: 'end', description: '', x: 500, y: 160 },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'list', label: '进入', type: 'next' },
            { id: 'e2', source: 'list', target: 'end', label: '', type: 'success' },
          ],
        },
        {
          key: 'novel-detail',
          name: '小说详情',
          description: '查看与编辑设定',
          ref_path: '/novels/:id',
          nodes: [
            { id: 'start', name: '开始', type: 'start', description: '', x: 80, y: 160 },
            { id: 'detail', name: '小说详情', type: 'page', description: '', x: 280, y: 160 },
            { id: 'end', name: '结束', type: 'end', description: '', x: 500, y: 160 },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'detail', label: '打开', type: 'next' },
            { id: 'e2', source: 'detail', target: 'end', label: '', type: 'success' },
          ],
        },
      ],
    },
    {
      name: '小说创作平台 BFF',
      type: 'backend',
      description: 'novel-sub Egg.js BFF：小说 CRUD、枚举、Schema 启动同步。不含 Agent 执行。',
      repo_url: '',
      source_path: 'admin-management-station/project-sub/novel-sub/backend',
      status: 'active',
      directory_tree: [
        {
          name: 'backend',
          type: 'dir',
          description: 'Egg.js BFF',
          children: [
            {
              name: 'app',
              type: 'dir',
              description: '',
              children: [
                { name: 'controller', type: 'dir', description: 'HTTP 入参校验', children: [] },
                { name: 'service', type: 'dir', description: '业务逻辑', children: [] },
                { name: 'model', type: 'dir', description: 'Sequelize 模型', children: [] },
                { name: 'lib', type: 'dir', description: 'schemaSync 等', children: [] },
                { name: 'router.js', type: 'file', description: '路由表', children: [] },
              ],
            },
            { name: 'config', type: 'dir', description: '端口 / Postgres / CORS', children: [] },
          ],
        },
        { name: 'database', type: 'dir', description: 'init.sql + migrations', children: [] },
      ],
      routes: [],
      flows: [
        {
          key: 'novel-crud',
          name: '小说 CRUD',
          description: '列表查询与详情读写',
          nodes: [
            { id: 'start', name: '开始', type: 'start', description: '', x: 60, y: 160 },
            { id: 'list', name: 'GET /api/novels', type: 'api', description: '筛选 / 分页', x: 240, y: 80 },
            { id: 'show', name: 'GET /api/novels/:id', type: 'api', description: '详情含 setting_json', x: 240, y: 240 },
            { id: 'save', name: 'PUT /api/novels/:id', type: 'api', description: '更新基础信息', x: 460, y: 160 },
            { id: 'end', name: '结束', type: 'end', description: '', x: 680, y: 160 },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'list', label: '列表', type: 'next' },
            { id: 'e2', source: 'start', target: 'show', label: '详情', type: 'next' },
            { id: 'e3', source: 'show', target: 'save', label: '编辑', type: 'next' },
            { id: 'e4', source: 'list', target: 'end', label: '', type: 'success' },
            { id: 'e5', source: 'save', target: 'end', label: '成功', type: 'success' },
          ],
        },
      ],
    },
  ];
}

module.exports = {
  SCHEMA_ID,
  TEMPLATE_VERSION,
  PROJECT_TYPES,
  PROJECT_STATUSES,
  NODE_TYPES,
  NODE_SEVERITIES,
  EDGE_TYPES,
  FIELD_GUIDE,
  emptyDirectoryNode,
  emptyRoute,
  emptyFlow,
  emptyOverviewFlow,
  buildEmptyTemplate,
  normalizeProjectPayload,
  parseImportDocument,
  serializeExport,
  demoProjects,
};
