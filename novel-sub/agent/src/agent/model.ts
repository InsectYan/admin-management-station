/**
 * @file model.ts
 * @description 将 LlmRuntimeConfig 映射为 Pi 所需的 OpenAI 兼容 Model 对象。
 */
import type { Model } from "@earendil-works/pi-ai";
import { config } from "../config.js";
import type { LlmRuntimeConfig } from "./llmProfiles.js";

/**
 * 解析 Pi 会话使用的聊天模型描述。
 * @param llm - 可选运行时 LLM 配置，缺省则用 config.llm
 * @returns Pi Model 对象（openai-completions 兼容）
 */
export function resolveChatModel(llm?: LlmRuntimeConfig): Model<"openai-completions"> {
  const modelId = llm?.model ?? config.llm.model;
  const baseUrl = llm?.baseUrl ?? config.llm.baseUrl;
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "openai",
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      maxTokensField: "max_tokens",
    },
  };
}
