import type { LlmRuntimeConfig } from "../agent/llmProfiles.js";
import { resolveLlmProfile } from "../agent/llmProfiles.js";

export async function resolveChatLlm(input: {
  generalProfileId?: string | null;
  stageModelId?: string | null;
}): Promise<{
  llm: LlmRuntimeConfig;
  source: "stage" | "general";
  stageModelIdUsed: string | null;
  stageModelRejected?: { name: string; missing_fields: string[] };
}> {
  void input.stageModelId;
  return {
    llm: resolveLlmProfile(input.generalProfileId),
    source: "general",
    stageModelIdUsed: null,
  };
}
