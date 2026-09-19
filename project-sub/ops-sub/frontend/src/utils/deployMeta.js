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

/** 解析 v0.0.1 / 0.0.1 类版本；非语义化返回 null */
export function parseSemverTag(name) {
  const raw = String(name || '').trim();
  const matched = raw.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  if (!matched) return null;
  return {
    name: raw,
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    prefix: /^v/i.test(raw) ? 'v' : (raw.startsWith('V') ? 'V' : 'v'),
  };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * 根据远程已有 tag 生成下一发布号：取最新语义化版本 patch+1。
 * 无 tag → v0.0.1；最新 v0.0.1 → v0.0.2。
 */
export function nextReleaseTag(tagNames, { fallback = 'v0.0.1' } = {}) {
  const parsed = (Array.isArray(tagNames) ? tagNames : [])
    .map((item) => parseSemverTag(typeof item === 'string' ? item : item?.name))
    .filter(Boolean)
    .sort(compareSemver);
  if (!parsed.length) return fallback;
  const latest = parsed[parsed.length - 1];
  return `${latest.prefix || 'v'}${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

export function latestSemverTag(tagNames) {
  const parsed = (Array.isArray(tagNames) ? tagNames : [])
    .map((item) => parseSemverTag(typeof item === 'string' ? item : item?.name))
    .filter(Boolean)
    .sort(compareSemver);
  return parsed.length ? parsed[parsed.length - 1].name : '';
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

export const AGENTRUN_CODE_LANGUAGES = [
  { value: 'nodejs18', label: 'Node.js 18' },
  { value: 'nodejs20', label: 'Node.js 20（默认）' },
  { value: 'nodejs22', label: 'Node.js 22' },
];

export const AGENTRUN_FIELD_TIPS = {
  package_path: '仓库内相对路径，指向预打好的 zip（推荐 backup/ss.zip）。运维从 Git 按该路径取包后直接 s deploy 上传阿里云，不再 pack。也可只填目录 backup（目录内需有 artifact.zip，或仅一个 .zip）。留空则走 fitness-cli（会 pack）。',
  account_id: '必填。阿里云主账号 UID（约 16 位数字），不是 RAM 子用户 ID。控制台右上角头像 → 账号中心 → 账号 ID。写入 Serverless Devs 的 AccountID。',
  access_key_id: 'RAM 子用户 AccessKey ID。推荐用子用户，不要用主账号 AK。',
  access_key_secret: 'AccessKey Secret，创建时只显示一次，勿提交 git。',
  sd_access: 'Serverless Devs 别名，必须等于环境文件里的 SD_ACCESS，例如 fitness-prod。',
  target_env: '决定写入 .env.prod 还是 .env.test，以及对应的 s.yaml。',
  region: 'AgentRun 地域，须与 VPC / RDS / NAS 相同。常见 cn-hangzhou 或 cn-beijing。',
  workspace_id: 'AgentRun 工作空间 ID，控制台复制。为空常见报错 No default workspace found。',
  agent_name: '运行时名称，对应 yaml 里的 AGENT_NAME。',
  endpoint_name: 'Endpoint 名称，生产常见 production。',
  code_language: '写入 CODE_LANGUAGE，对应 AgentRun 代码包运行时。默认 Node.js 20；请与仓库 engines / 依赖兼容性一致。',
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
