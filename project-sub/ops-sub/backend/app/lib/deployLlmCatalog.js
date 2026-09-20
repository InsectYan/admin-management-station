'use strict';

/**
 * AgentRun 部署用 LLM 模型目录（与 fitness-agent `.pi/src/pi/llmProfiles.ts` 对齐）。
 * 同一 provider 共用一把 API Key。
 */

/** @typedef {{ id: string, label: string, provider: string, model: string, apiKeyEnv: string, baseUrl: string, baseUrlEnv?: string, vision?: boolean }} LlmProfileDef */

/** @type {LlmProfileDef[]} */
const AGENTRUN_LLM_PROFILES = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek · deepseek-chat',
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek · deepseek-reasoner',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  {
    id: 'deepseek-vision',
    label: 'DeepSeek · v4-flash-vision-exp（看图）',
    provider: 'deepseek',
    model: 'deepseek-v4-flash-vision-exp',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
    vision: true,
  },
  {
    id: 'qwen-turbo',
    label: '通义千问 · qwen-turbo',
    provider: 'dashscope',
    model: 'qwen-turbo',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'DASHSCOPE_BASE_URL',
  },
  {
    id: 'qwen-plus',
    label: '通义千问 · qwen-plus',
    provider: 'dashscope',
    model: 'qwen-plus',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'DASHSCOPE_BASE_URL',
  },
  {
    id: 'qwen-max',
    label: '通义千问 · qwen-max',
    provider: 'dashscope',
    model: 'qwen-max',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'DASHSCOPE_BASE_URL',
  },
  {
    id: 'qwen-vl-plus',
    label: '通义千问 · qwen-vl-plus（看图）',
    provider: 'dashscope',
    model: 'qwen-vl-plus',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'DASHSCOPE_BASE_URL',
    vision: true,
  },
  {
    id: 'zhipu-flash',
    label: '智谱 · glm-4-flash',
    provider: 'zhipu',
    model: 'glm-4-flash',
    apiKeyEnv: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    baseUrlEnv: 'ZHIPU_BASE_URL',
  },
  {
    id: 'zhipu-plus',
    label: '智谱 · glm-4-plus',
    provider: 'zhipu',
    model: 'glm-4-plus',
    apiKeyEnv: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    baseUrlEnv: 'ZHIPU_BASE_URL',
  },
  {
    id: 'openai-mini',
    label: 'OpenAI · gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
  {
    id: 'openai-4o',
    label: 'OpenAI · gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
];

const DEFAULT_LLM_PROFILE_ID = 'deepseek-reasoner';

const PROVIDER_KEY_LABELS = {
  DEEPSEEK_API_KEY: 'DeepSeek API Key',
  DASHSCOPE_API_KEY: '通义千问 / 百炼 API Key（DASHSCOPE_API_KEY）',
  ZHIPU_API_KEY: '智谱 API Key',
  OPENAI_API_KEY: 'OpenAI API Key',
};

function findLlmProfile(profileId) {
  const id = String(profileId || '').trim();
  return AGENTRUN_LLM_PROFILES.find(item => item.id === id) || null;
}

function resolveLlmProfile(profileId) {
  return findLlmProfile(profileId) || findLlmProfile(DEFAULT_LLM_PROFILE_ID) || AGENTRUN_LLM_PROFILES[0];
}

/** 按选定模型写入 LLM_* 与对应 baseUrl；不改动各家 API Key（由表单按 provider 共用保存） */
function applyLlmProfileToRuntime(runtime, profileId) {
  const target = runtime && typeof runtime === 'object' ? runtime : {};
  const profile = resolveLlmProfile(profileId || target.LLM_DEFAULT_PROFILE);
  target.LLM_DEFAULT_PROFILE = profile.id;
  target.LLM_PROVIDER = profile.provider;
  target.LLM_MODEL_NAME = profile.model;
  if (profile.baseUrlEnv && profile.baseUrl) {
    const current = String(target[profile.baseUrlEnv] || '').trim();
    if (!current || current === '-' || current === 'CHANGE_ME') {
      target[profile.baseUrlEnv] = profile.baseUrl;
    }
  }
  return profile;
}

function requiredApiKeyEnv(runtime) {
  const profile = resolveLlmProfile(runtime?.LLM_DEFAULT_PROFILE);
  return profile.apiKeyEnv;
}

function listLlmProfilesPublic() {
  return AGENTRUN_LLM_PROFILES.map(item => ({
    id: item.id,
    label: item.label,
    provider: item.provider,
    model: item.model,
    apiKeyEnv: item.apiKeyEnv,
    apiKeyLabel: PROVIDER_KEY_LABELS[item.apiKeyEnv] || item.apiKeyEnv,
    baseUrl: item.baseUrl,
    baseUrlEnv: item.baseUrlEnv || '',
    vision: Boolean(item.vision),
  }));
}

module.exports = {
  AGENTRUN_LLM_PROFILES,
  DEFAULT_LLM_PROFILE_ID,
  PROVIDER_KEY_LABELS,
  findLlmProfile,
  resolveLlmProfile,
  applyLlmProfileToRuntime,
  requiredApiKeyEnv,
  listLlmProfilesPublic,
};
