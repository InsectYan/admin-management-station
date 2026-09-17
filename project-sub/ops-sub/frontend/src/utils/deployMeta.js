export const DEPLOY_STATUS_OPTIONS = [
  { value: 'queued', label: '排队', type: 'info' },
  { value: 'running', label: '进行中', type: 'warning' },
  { value: 'success', label: '成功', type: 'success' },
  { value: 'failed', label: '失败', type: 'danger' },
  { value: 'aborted', label: '已中止', type: 'info' },
];

export function deployStatusMeta(value) {
  return DEPLOY_STATUS_OPTIONS.find((item) => item.value === value)
    || { value, label: value || '未知', type: 'info' };
}

export function isActiveDeploy(status) {
  return status === 'queued' || status === 'running';
}

export function deployDuration(job) {
  if (!job?.started_at) return '—';
  const start = new Date(job.started_at).getTime();
  const end = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function defaultDeployParams(projectType) {
  const common = { env: 'staging', notify_email: '' };
  if (projectType === 'backend') {
    return { ...common, install_cmd: 'npm ci', start_hint: 'npm run start' };
  }
  if (projectType === 'agent') {
    return { ...common, skill_name: '' };
  }
  return { ...common, build_cmd: 'npm ci && npm run build', out_dir: 'dist' };
}

/** 产品目录写死在代码，不入库。接口失败时用这份兜底，避免下拉空白。 */
export const FALLBACK_DEPLOY_PRODUCTS = [
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

export const AGENTRUN_FIELD_TIPS = {
  account_id: '必填。阿里云主账号 UID（约 16 位数字），不是 RAM 子用户 ID。控制台右上角头像 → 账号中心 → 账号 ID。写入 Serverless Devs 的 AccountID。',
  access_key_id: 'RAM 子用户 AccessKey ID。推荐用子用户，不要用主账号 AK。',
  access_key_secret: 'AccessKey Secret，创建时只显示一次，勿提交 git。',
  sd_access: 'Serverless Devs 别名，必须等于环境文件里的 SD_ACCESS，例如 fitness-prod。',
  target_env: '决定写入 .env.prod 还是 .env.test，以及对应的 s.yaml。',
  region: 'AgentRun 地域，须与 VPC / RDS / NAS 相同。常见 cn-hangzhou 或 cn-beijing。',
  workspace_id: 'AgentRun 工作空间 ID，控制台复制。为空常见报错 No default workspace found。',
  agent_name: '运行时名称，对应 yaml 里的 AGENT_NAME。',
  endpoint_name: 'Endpoint 名称，生产常见 production。',
  agent_base_url: '发布后的调用根地址（平台域名）。套壳用它访问 Agent。',
  vpc_id: '须与 RDS、NAS 同一 VPC。可只填 ID 后半段，保存时自动补 vpc- 前缀。漏填会在提交时直接拦住。',
  vswitch_id: '交换机 ID。可只填后半段，保存时自动补 vsw-。',
  security_group_id: '安全组 ID。可只填后半段，保存时自动补 sg-。',
  nas_server_addr: 'NAS 挂载地址，容器会话文件落在这里。',
  log_project: 'SLS 日志项目。',
  log_store: 'SLS Logstore，生产模板常见 fitness-agent-prod。',
  DATABASE_URL: 'Agent 使用的 PostgreSQL 连接串。库名须为 fitness_agent，不是 fitness_shell。',
  AGENT_DATABASE_URL: '可空。空则与 DATABASE_URL 相同。',
  INTERNAL_API_KEY: '套壳 Gateway 调用 Agent 内部接口（/v1/agent/*）的共享密钥，须与业务服务一致。禁止下发到前端。',
  DEEPSEEK_API_KEY: '大模型 API 密钥。',
  CLOUD_DATA_OPS_TOKEN: '云端 wipe / 导出 NAS 的运维口令，仅 CLI 签名，不要给套壳。未配置则不挂载 ops 路由。',
  SHELL_BASE_URL: 'Agent 回调套壳 / 进度口的内网根地址。不要填启炼业务域名。',
  CORS_ORIGIN: '允许的前端来源。* 表示不限制。',
  LEJIAN_API_BASE_URL: '启炼业务源站，只填 origin，例如 https://lejian-api.bboycc.cn。',
  cli_command: '默认 fitness-cli prod。真正执行时改写成 node deploy/scripts/run.mjs。',
};

export function parseDeployProductCatalog(raw) {
  const list = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
  if (list.length) {
    return {
      list,
      defaults: raw?.defaults && typeof raw.defaults === 'object' ? raw.defaults : {},
    };
  }
  return { list: FALLBACK_DEPLOY_PRODUCTS, defaults: {} };
}
