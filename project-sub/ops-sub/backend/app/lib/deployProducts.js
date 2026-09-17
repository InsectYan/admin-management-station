'use strict';

/**
 * 部署产品目录（写死在代码，不入库）。
 * AgentRun 可真跑；其余产品本期只演示表单。
 */

const PRODUCTS = [
  {
    id: 'generic',
    name: '通用构建（Git + npm）',
    status: 'live',
    description: '按项目类型拉 tag、白名单构建。适合前端 / BFF。',
  },
  {
    id: 'agentrun',
    name: '阿里云 AgentRun',
    status: 'live',
    description: '按 fitness-agent 的 fitness-cli prod：写入本机本该有的 AK 与 .env，再打包发布 .pi。',
  },
  {
    id: 'aliyun_ecs',
    name: '阿里云 ECS',
    status: 'demo',
    description: '演示：主机、地域、SSH。本期不真正登录机器。',
  },
  {
    id: 'tencent_cvm',
    name: '腾讯云 CVM',
    status: 'demo',
    description: '演示：实例、地域、密钥。本期不真正调用腾讯云。',
  },
];

const AGENTRUN_PREREQS = [
  { key: 'ram_policy', label: 'RAM 子用户已授 AliyunAgentRunFullAccess', configurable: false },
  { key: 'runtime_role', label: '运行时角色 AliyunAgentRunDefaultRole（yaml 固定，一般不用改）', configurable: false },
  { key: 'infra', label: 'VPC / RDS(fitness_agent) / NAS / SLS / AgentRun Workspace 已在控制台建好', configurable: false },
  { key: 'affinity', label: '发版后需在 AgentRun 控制台关闭会话亲和（文档要求）', configurable: false },
];

function defaultAgentrun() {
  return {
    target_env: 'prod',
    cli_command: 'fitness-cli prod',
    account: {
      account_id: '',
      access_key_id: '',
      access_key_secret: '',
      sd_access: 'fitness-prod',
    },
    platform: {
      region: 'cn-hangzhou',
      workspace_id: '',
      agent_name: 'fitness-pi-server-prod-code',
      endpoint_name: 'production',
      agent_base_url: '',
      vpc_id: '',
      vswitch_id: '',
      security_group_id: '',
      nas_server_addr: '',
      log_project: '',
      log_store: 'fitness-agent-prod',
      code_language: 'nodejs20',
    },
    runtime: {
      NODE_ENV: 'production',
      PORT: '3003',
      WORKSPACES_ROOT: '/mnt/nas/workspaces',
      KNOWLEDGE_ROOT: '/mnt/nas/KnowledgeBase',
      TEMPLATES_ROOT: '/code/workspaces-templates',
      WORKSPACE_PRUNE_AUTO: '0',
      CORS_ORIGIN: '*',
      SHELL_BASE_URL: '',
      SHELL_API_ENABLED: '1',
      LEJIAN_API_BASE_URL: 'https://lejian-api.bboycc.cn',
      SHELL_DATA_MOCK: '0',
      SHELL_DATA_MOCK_FALLBACK: '0',
      DATABASE_URL: '',
      AGENT_DATABASE_URL: '',
      INTERNAL_API_KEY: '',
      CLOUD_DATA_OPS_TOKEN: '',
      LLM_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: '',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
      LLM_DEFAULT_PROFILE: 'deepseek-reasoner',
      LLM_MODEL_NAME: 'deepseek-reasoner',
      COACH_TURN_MODE: 'async',
      COACH_TURN_WORKER: '1',
      COACH_TURN_WORKER_CONCURRENCY: '4',
      PG_POOL_MAX: '10',
      READY_DELAY_MS: '5000',
      SHUTDOWN_GRACE_MS: '30000',
      LOG_LEVEL: 'info',
      OTEL_ENABLED: '0',
      OTEL_EXPORT_MODE: 'arms',
      OTEL_SERVICE_NAME: 'fitness-pi-agent-prod',
      OTEL_EXPORTER_OTLP_ENDPOINT: '-',
    },
  };
}

function defaultEcs() {
  return {
    region: 'cn-hangzhou',
    instance_id: '',
    ssh_user: 'root',
    ssh_port: '22',
    deploy_path: '/opt/app',
    start_cmd: 'systemctl restart app',
  };
}

function defaultTencent() {
  return {
    region: 'ap-guangzhou',
    instance_id: '',
    secret_id: '',
    secret_key: '',
    deploy_path: '/opt/app',
  };
}

function emptyDeployConfig() {
  return {
    product: 'generic',
    code_source: 'local',
    git_branch: 'main',
    git_tag: '',
    agentrun: defaultAgentrun(),
    aliyun_ecs: defaultEcs(),
    tencent_cvm: defaultTencent(),
  };
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function ensureAliyunPrefix(value, prefix) {
  const text = String(value || '').trim();
  if (!text || text === 'CHANGE_ME' || text === '-') return text;
  if (text.startsWith(prefix)) return text;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text)) return text;
  return prefix + text;
}

function mergeDeep(base, extra) {
  const out = { ...base };
  for (const [ key, value ] of Object.entries(asObject(extra))) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(asObject(base[key]), value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeDeployConfig(raw) {
  const input = asObject(raw);
  const base = emptyDeployConfig();
  const product = PRODUCTS.some(item => item.id === input.product) ? input.product : 'generic';
  const codeSource = [ 'local', 'github' ].includes(String(input.code_source || '').trim())
    ? String(input.code_source).trim()
    : base.code_source;
  const gitBranch = String(input.git_branch || '').trim() || base.git_branch;
  const gitTag = String(input.git_tag || '').trim();
  const agentrun = mergeDeep(base.agentrun, input.agentrun);
  agentrun.platform = {
    ...asObject(agentrun.platform),
    vpc_id: ensureAliyunPrefix(agentrun.platform?.vpc_id, 'vpc-'),
    vswitch_id: ensureAliyunPrefix(agentrun.platform?.vswitch_id, 'vsw-'),
    security_group_id: ensureAliyunPrefix(agentrun.platform?.security_group_id, 'sg-'),
  };
  return {
    product,
    code_source: codeSource,
    git_branch: gitBranch,
    git_tag: gitTag,
    agentrun,
    aliyun_ecs: mergeDeep(base.aliyun_ecs, input.aliyun_ecs),
    tencent_cvm: mergeDeep(base.tencent_cvm, input.tencent_cvm),
  };
}

function findProduct(id) {
  return PRODUCTS.find(item => item.id === id) || PRODUCTS[0];
}

function isDemoProduct(id) {
  return findProduct(id).status === 'demo';
}

function isAgentrun(id) {
  return id === 'agentrun';
}

function assertAgentrunReady(config) {
  const ar = asObject(config.agentrun);
  const account = asObject(ar.account);
  const platform = asObject(ar.platform);
  const runtime = asObject(ar.runtime);
  const missing = [];
  if (!account.account_id) missing.push('阿里云主账号 UID（AccountID，不是 RAM 子用户 ID）');
  if (!account.access_key_id) missing.push('AccessKey ID');
  if (!account.access_key_secret) missing.push('AccessKey Secret');
  if (!account.sd_access) missing.push('Serverless Devs 别名');
  if (!platform.workspace_id) missing.push('AgentRun Workspace ID');
  if (!platform.region) missing.push('地域');
  if (!platform.vpc_id) missing.push('VPC_ID');
  if (!platform.vswitch_id) missing.push('VSWITCH_ID');
  if (!platform.security_group_id) missing.push('SECURITY_GROUP_ID');
  if (!runtime.DATABASE_URL && !runtime.AGENT_DATABASE_URL) missing.push('DATABASE_URL');
  if (!runtime.INTERNAL_API_KEY) missing.push('INTERNAL_API_KEY');
  if (!runtime.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
  if (missing.length) {
    const err = new Error(`AgentRun 配置不完整：${missing.join('、')}`);
    err.status = 400;
    throw err;
  }
}

function resolveCliArgv(cliCommand, targetEnv) {
  const raw = String(cliCommand || '').trim() || `fitness-cli ${targetEnv || 'prod'}`;
  const env = [ 'prod', 'test' ].includes(String(targetEnv)) ? targetEnv : 'prod';
  if (/^fitness(-cli)?(\s|$)/i.test(raw) || /^fitness-cli\b/i.test(raw)) {
    const rest = raw.replace(/^fitness(-cli)?\s*/i, '').trim();
    const task = rest.split(/\s+/)[0] || env;
    return [ 'node', 'deploy/scripts/run.mjs', task ];
  }
  if (/^node\s+/.test(raw)) {
    return raw.split(/\s+/).filter(Boolean);
  }
  const err = new Error('部署指令仅允许 fitness-cli / node deploy/scripts/run.mjs');
  err.status = 400;
  throw err;
}

function listProductsPublic() {
  return {
    list: PRODUCTS.map(item => ({ ...item })),
    prerequisites: { agentrun: AGENTRUN_PREREQS },
    defaults: emptyDeployConfig(),
  };
}

module.exports = {
  PRODUCTS,
  AGENTRUN_PREREQS,
  emptyDeployConfig,
  normalizeDeployConfig,
  findProduct,
  isDemoProduct,
  isAgentrun,
  assertAgentrunReady,
  resolveCliArgv,
  listProductsPublic,
  ensureAliyunPrefix,
};
