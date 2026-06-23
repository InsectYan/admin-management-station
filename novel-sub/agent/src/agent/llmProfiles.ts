/**
 * @file llmProfiles.ts
 * @description 预置 LLM 配置目录，解析可用模型、默认 profile 与运行时连接参数。
 */
import { config } from "../config.js";

/** 解析后的 LLM 运行时配置，供 Pi 会话与 API 列表使用。 */
export interface LlmRuntimeConfig {
  profileId: string;
  label: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
}

/** 静态 profile 定义（目录项，非运行时对象）。 */
interface ProfileDef {
  id: string;
  label: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyEnv?: "OPENAI_API_KEY" | "ZHIPU_API_KEY" | "DEEPSEEK_API_KEY";
  /** 本地 Ollama：仅需可访问的 OpenAI 兼容 base URL */
  localOllama?: boolean;
  modelEnv?: string;
}

const CATALOG: ProfileDef[] = [
  {
    id: "ollama-qwen",
    label: "本地 Ollama · qwen",
    provider: "ollama",
    model: "qwen3.6:latest",
    baseUrl: "http://localhost:11434/v1",
    localOllama: true,
    modelEnv: "OLLAMA_MODEL",
  },
  {
    id: "ollama-qwen-gen",
    label: "本地 Ollama · qwen（生成）",
    provider: "ollama",
    model: "qwen3.6:latest",
    baseUrl: "http://localhost:11434/v1",
    localOllama: true,
    modelEnv: "OLLAMA_MODEL",
  },
  {
    id: "openai-mini",
    label: "OpenAI · gpt-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    id: "openai-4o",
    label: "OpenAI · gpt-4o",
    provider: "openai",
    model: "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    id: "zhipu-flash",
    label: "智谱 · glm-4-flash",
    provider: "zhipu",
    model: "glm-4-flash",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyEnv: "ZHIPU_API_KEY",
  },
  {
    id: "zhipu-plus",
    label: "智谱 · glm-4-plus",
    provider: "zhipu",
    model: "glm-4-plus",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyEnv: "ZHIPU_API_KEY",
  },
  {
    id: "deepseek-chat",
    label: "DeepSeek · deepseek-chat",
    provider: "deepseek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
];

/**
 * 读取指定环境变量中的 API Key。
 * @param name - 环境变量名
 * @returns 去空白后的 key 字符串
 */
function envKey(name: NonNullable<ProfileDef["apiKeyEnv"]>): string {
  return (process.env[name] || "").trim();
}

/**
 * 解析 Ollama 的 OpenAI 兼容 base URL。
 * @param def - profile 定义
 * @returns base URL
 */
function ollamaBaseUrl(def: ProfileDef): string {
  return (process.env.OLLAMA_BASE_URL || process.env.BASE_URL || def.baseUrl).trim();
}

/**
 * 解析 Ollama 实际使用的模型名。
 * @param def - profile 定义
 * @returns 模型标识
 */
function ollamaModel(def: ProfileDef): string {
  return (process.env[def.modelEnv || "OLLAMA_MODEL"] || def.model).trim();
}

/**
 * 判断 profile 在当前环境下是否可用（有 key 或可访问的 Ollama URL）。
 * @param def - profile 定义
 * @returns 是否可用
 */
function profileAvailable(def: ProfileDef): boolean {
  if (def.localOllama) {
    return ollamaBaseUrl(def).length > 0;
  }
  return envKey(def.apiKeyEnv!).length > 0;
}

/**
 * 按 provider 与环境变量解析 API base URL。
 * @param def - profile 定义
 * @returns 解析后的 base URL
 */
function resolveBaseUrl(def: ProfileDef): string {
  if (def.localOllama) return ollamaBaseUrl(def);
  if (def.provider === "deepseek") {
    return (process.env.DEEPSEEK_BASE_URL || def.baseUrl).trim();
  }
  if (def.provider === "zhipu") {
    return (process.env.ZHIPU_BASE_URL || def.baseUrl).trim();
  }
  if (def.provider === "openai") {
    return (process.env.BASE_URL || def.baseUrl).trim();
  }
  return def.baseUrl;
}

/**
 * 将静态 profile 定义转为运行时配置。
 * @param def - profile 定义
 * @returns LLM 运行时配置
 */
function defToRuntime(def: ProfileDef): LlmRuntimeConfig {
  const apiKey = def.localOllama
    ? (process.env.OPENAI_API_KEY || "ollama").trim()
    : envKey(def.apiKeyEnv!);
  return {
    profileId: def.id,
    label: def.label,
    provider: def.provider,
    model: def.localOllama ? ollamaModel(def) : def.model,
    baseUrl: resolveBaseUrl(def),
    apiKey,
  };
}

/**
 * 列出所有预置 LLM profile 及其可用状态（供前端选择器使用）。
 * @returns profile 摘要数组
 */
export function listLlmProfiles(): Array<{
  id: string;
  label: string;
  provider: string;
  model: string;
  available: boolean;
}> {
  return CATALOG.map((d) => ({
    id: d.id,
    label: d.label,
    provider: d.provider,
    model: d.localOllama ? ollamaModel(d) : d.model,
    available: profileAvailable(d),
  }));
}

/**
 * 确定默认 profile ID：优先环境变量，再按 LLM_PROVIDER 匹配可用项。
 * @returns 默认 profile 的 id
 */
export function getDefaultLlmProfileId(): string {
  const fromEnv = (process.env.LLM_DEFAULT_PROFILE || "").trim();
  if (fromEnv && resolveLlmProfile(fromEnv).profileId === fromEnv) {
    const def = CATALOG.find((d) => d.id === fromEnv);
    if (def && profileAvailable(def)) return fromEnv;
  }
  const preferred = (process.env.LLM_PROVIDER || "ollama").trim().toLowerCase();
  const pick = CATALOG.find((d) => profileAvailable(d) && d.provider === preferred);
  const any = CATALOG.find((d) => profileAvailable(d));
  return pick?.id ?? any?.id ?? "ollama-qwen";
}

/**
 * 按 profile ID 解析运行时 LLM 配置，不可用时回退至默认或 config。
 * @param profileId - 可选 profile ID
 * @returns 可用的 LLM 运行时配置
 */
export function resolveLlmProfile(profileId?: string | null): LlmRuntimeConfig {
  const id = (profileId || "").trim() || getDefaultLlmProfileId();
  const def = CATALOG.find((d) => d.id === id);
  if (def && profileAvailable(def)) return defToRuntime(def);

  const fallbackId = getDefaultLlmProfileId();
  const fallback = CATALOG.find((d) => d.id === fallbackId);
  if (fallback && profileAvailable(fallback)) return defToRuntime(fallback);

  return {
    profileId: "env-fallback",
    label: "环境默认",
    provider: config.llm.provider,
    model: config.llm.model,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
  };
}
