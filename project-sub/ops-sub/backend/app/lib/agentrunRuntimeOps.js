'use strict';

const {
  listRuntime,
  getRuntime,
  updateRuntime,
  waitReady,
  runtimeIdOf,
  statusOf,
  envMapOf,
  languageOf,
} = require('./agentrunOpenApi');
const {
  findLlmProfile,
  applyLlmProfileToRuntime,
  listLlmProfilesPublic,
} = require('./deployLlmCatalog');
const { normalizeDeployConfig, isAgentrun } = require('./deployProducts');

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasUsableKey(value) {
  const text = String(value || '').trim();
  return Boolean(text && text !== '-' && text !== 'CHANGE_ME');
}

function resolveAccountCreds(agentrun) {
  const account = asObject(agentrun.account);
  const accessKeyId = String(account.access_key_id || '').trim();
  const accessKeySecret = String(account.access_key_secret || '').trim();
  if (!accessKeyId || !accessKeySecret) {
    const err = new Error('缺少阿里云 AccessKey，请先在部署配置中填写账号 AK/SK');
    err.status = 400;
    throw err;
  }
  return { accessKeyId, accessKeySecret };
}

function resolvePlatform(agentrun) {
  const platform = asObject(agentrun.platform);
  const region = String(platform.region || 'cn-hangzhou').trim();
  const agentName = String(platform.agent_name || '').trim();
  const workspaceId = String(platform.workspace_id || '').trim();
  if (!agentName) {
    const err = new Error('缺少 Agent 名称（AGENT_NAME）');
    err.status = 400;
    throw err;
  }
  if (!workspaceId) {
    const err = new Error('缺少 Workspace ID');
    err.status = 400;
    throw err;
  }
  return { region, agentName, workspaceId, platform };
}

function bindingOf(agentrun) {
  return asObject(agentrun.binding);
}

function buildBinding(rt, agentrun, extra = {}) {
  const platform = asObject(agentrun.platform);
  const env = envMapOf(rt);
  return {
    agent_runtime_id: runtimeIdOf(rt),
    agent_name: String(rt.agentRuntimeName || rt.AgentRuntimeName || platform.agent_name || ''),
    region: String(platform.region || 'cn-hangzhou'),
    workspace_id: String(rt.workspaceId || rt.WorkspaceId || platform.workspace_id || ''),
    endpoint_name: String(platform.endpoint_name || 'production'),
    endpoint_url: String(platform.agent_base_url || ''),
    code_language: languageOf(rt) || String(platform.code_language || ''),
    status: statusOf(rt),
    llm_profile: String(env.LLM_DEFAULT_PROFILE || asObject(agentrun.runtime).LLM_DEFAULT_PROFILE || ''),
    llm_provider: String(env.LLM_PROVIDER || ''),
    llm_model: String(env.LLM_MODEL_NAME || ''),
    synced_at: new Date().toISOString(),
    ...extra,
  };
}

async function resolveRuntime(creds, agentrun) {
  const { region, agentName, workspaceId } = resolvePlatform(agentrun);
  const binding = bindingOf(agentrun);
  let rt = null;
  if (binding.agent_runtime_id) {
    try {
      rt = await getRuntime(creds, region, binding.agent_runtime_id);
    } catch {
      rt = null;
    }
  }
  if (!rt || !runtimeIdOf(rt)) {
    rt = await listRuntime(creds, region, agentName, workspaceId);
  }
  if (!rt || !runtimeIdOf(rt)) {
    const err = new Error(`未找到线上运行时 ${agentName}，请先完成一次 AgentRun 部署`);
    err.status = 404;
    throw err;
  }
  return { rt, region, agentName, workspaceId };
}

function profilesAvailability(env, localRuntime) {
  const merged = { ...asObject(localRuntime), ...asObject(env) };
  return listLlmProfilesPublic().map(item => ({
    ...item,
    available: hasUsableKey(merged[item.apiKeyEnv]),
  }));
}

async function readCloudStatus(project) {
  const deployConfig = normalizeDeployConfig(project.deploy_config);
  if (!isAgentrun(deployConfig.product)) {
    return {
      product: deployConfig.product,
      agentrun: false,
      message: '当前项目不是 AgentRun 产品，无法查询线上运行时',
    };
  }
  const agentrun = asObject(deployConfig.agentrun);
  const creds = resolveAccountCreds(agentrun);
  const { rt, region } = await resolveRuntime(creds, agentrun);
  const env = envMapOf(rt);
  const profiles = profilesAvailability(env, agentrun.runtime);
  const currentProfileId = String(env.LLM_DEFAULT_PROFILE || asObject(agentrun.runtime).LLM_DEFAULT_PROFILE || '');
  const binding = buildBinding(rt, agentrun, {
    endpoint_url: String(asObject(agentrun.platform).agent_base_url || ''),
  });
  return {
    product: 'agentrun',
    agentrun: true,
    region,
    binding,
    status: statusOf(rt),
    code_language: languageOf(rt),
    current_llm_profile: currentProfileId,
    current_llm_provider: String(env.LLM_PROVIDER || ''),
    current_llm_model: String(env.LLM_MODEL_NAME || ''),
    profiles,
    keys_present: {
      DEEPSEEK_API_KEY: hasUsableKey(env.DEEPSEEK_API_KEY),
      DASHSCOPE_API_KEY: hasUsableKey(env.DASHSCOPE_API_KEY),
      ZHIPU_API_KEY: hasUsableKey(env.ZHIPU_API_KEY),
      OPENAI_API_KEY: hasUsableKey(env.OPENAI_API_KEY),
    },
  };
}

async function switchLlmProfile(project, profileId) {
  const deployConfig = normalizeDeployConfig(project.deploy_config);
  if (!isAgentrun(deployConfig.product)) {
    const err = new Error('仅 AgentRun 项目支持切换模型');
    err.status = 400;
    throw err;
  }
  const agentrun = asObject(deployConfig.agentrun);
  const profile = findLlmProfile(profileId);
  if (!profile) {
    const err = new Error(`未知模型：${profileId || '(空)'}`);
    err.status = 400;
    throw err;
  }

  const creds = resolveAccountCreds(agentrun);
  const { rt, region } = await resolveRuntime(creds, agentrun);
  const id = runtimeIdOf(rt);
  const env = envMapOf(rt);

  if (!hasUsableKey(env[profile.apiKeyEnv])) {
    const localKey = asObject(agentrun.runtime)[profile.apiKeyEnv];
    if (!hasUsableKey(localKey)) {
      const err = new Error(
        `线上运行时未配置 ${profile.apiKeyEnv}，无法切换到「${profile.label}」。请先在部署配置填写该厂商 API Key 并重新部署（或更新环境变量）。`,
      );
      err.status = 400;
      throw err;
    }
    // 本地有 Key、线上没有：把本地 Key 一并写入，避免只改 profile 却不可用
    env[profile.apiKeyEnv] = String(localKey).trim();
  }

  if (String(env.LLM_DEFAULT_PROFILE || '') === profile.id
    && String(env.LLM_PROVIDER || '') === profile.provider
    && String(env.LLM_MODEL_NAME || '') === profile.model) {
    return {
      unchanged: true,
      message: `当前默认模型已是「${profile.label}」，无需切换`,
      binding: buildBinding(rt, agentrun),
      profile,
    };
  }

  const nextEnv = { ...env };
  nextEnv.LLM_DEFAULT_PROFILE = profile.id;
  nextEnv.LLM_PROVIDER = profile.provider;
  nextEnv.LLM_MODEL_NAME = profile.model;
  if (profile.baseUrlEnv && profile.baseUrl) {
    if (!hasUsableKey(nextEnv[profile.baseUrlEnv])) {
      nextEnv[profile.baseUrlEnv] = profile.baseUrl;
    }
  }

  await updateRuntime(creds, region, id, { environmentVariables: nextEnv });
  const ready = await waitReady(creds, region, id);
  const readyEnv = envMapOf(ready);
  if (String(readyEnv.LLM_DEFAULT_PROFILE || '') !== profile.id) {
    const err = new Error(
      `切换后校验失败：期望 LLM_DEFAULT_PROFILE=${profile.id}，实际为 ${readyEnv.LLM_DEFAULT_PROFILE || '(空)'}`,
    );
    err.status = 502;
    throw err;
  }

  const runtime = { ...asObject(agentrun.runtime) };
  applyLlmProfileToRuntime(runtime, profile.id);
  if (hasUsableKey(nextEnv[profile.apiKeyEnv])) {
    runtime[profile.apiKeyEnv] = nextEnv[profile.apiKeyEnv];
  }

  const nextAgentrun = {
    ...agentrun,
    runtime,
    binding: buildBinding(ready, { ...agentrun, runtime }),
  };
  const nextConfig = {
    ...deployConfig,
    agentrun: nextAgentrun,
  };

  return {
    unchanged: false,
    message: `已切换默认模型为「${profile.label}」，运行时已恢复 READY`,
    binding: nextAgentrun.binding,
    profile,
    deploy_config: nextConfig,
    status: statusOf(ready),
  };
}

async function syncBindingAfterDeploy(project, agentrunInput) {
  const deployConfig = normalizeDeployConfig(project.deploy_config);
  const agentrun = {
    ...asObject(deployConfig.agentrun),
    ...asObject(agentrunInput),
  };
  try {
    const creds = resolveAccountCreds(agentrun);
    const { rt } = await resolveRuntime(creds, agentrun);
    const binding = buildBinding(rt, agentrun);
    return {
      ...deployConfig,
      agentrun: {
        ...agentrun,
        binding,
      },
    };
  } catch {
    return null;
  }
}

module.exports = {
  readCloudStatus,
  switchLlmProfile,
  syncBindingAfterDeploy,
  buildBinding,
  hasUsableKey,
};
