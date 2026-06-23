import { initWorkspace } from "./workspaceInit.js";
import type { LlmRuntimeConfig } from "./llmProfiles.js";
import { runPiTurn, type PiTurnHooks, type TurnOutput } from "./runTurn.js";
import { workspacePath } from "./paths.js";

export interface NovelTurnContext {
  project_id?: string | null;
  novel_id?: string | null;
  llm?: LlmRuntimeConfig;
  hooks?: PiTurnHooks;
}

export const agentManager = {
  async novelTurn(
    userId: string | number,
    chatSessionId: string,
    message: string,
    ctx?: NovelTurnContext,
  ): Promise<TurnOutput> {
    initWorkspace("novel", userId, { USER_ID: String(userId) });
    return runPiTurn({
      role: "novel",
      entityId: userId,
      chatSessionId,
      message,
      context: ctx
        ? {
            project_id: ctx.project_id,
            novel_id: ctx.novel_id,
            llm_profile: ctx.llm?.profileId,
          }
        : undefined,
      llm: ctx?.llm,
      hooks: ctx?.hooks,
    });
  },

  workspaceFor(id: string | number): string {
    return workspacePath("novel", id);
  },
};
