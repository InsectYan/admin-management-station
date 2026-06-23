import { Router } from "express";
import type { PiTurnHooks } from "../../agent/runTurn.js";
import { agentManager } from "../../agent/agentManager.js";
import { resolveChatLlm } from "../resolveChatLlm.js";
import { appendAssistantLog, prepareChatMessage } from "../services/enrichMessage.js";
import { persistOutbox, type OutboxPayload } from "../services/outboxPersist.js";
import { AgentSseStream } from "../services/sseChatStream.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      creator_id,
      session_id,
      message,
      project_id,
      novel_id,
      llm_profile,
      panel_mode,
    } = req.body as {
      user_id?: string;
      creator_id?: string;
      session_id?: string;
      message?: string;
      project_id?: string;
      novel_id?: string;
      llm_profile?: string;
      panel_mode?: string;
    };

    if (!session_id?.trim() || !message?.trim()) {
      res.status(400).json({ error: "session_id, message required" });
      return;
    }

    const userId = (user_id || creator_id || "default").trim();
    const mode = panel_mode || "develop";

    if (mode !== "develop") {
      res.status(400).json({ error: "only panel_mode=develop is supported in agent-server scaffold" });
      return;
    }

    const llmResolved = await resolveChatLlm({
      generalProfileId: typeof llm_profile === "string" ? llm_profile : undefined,
    });
    const llm = llmResolved.llm;

    process.env.USER_ID = userId;
    process.env.CREATOR_ID = userId;
    process.env.BFF_URL = process.env.BFF_URL || `http://127.0.0.1:${process.env.PORT || process.env.AGENT_PORT || "7003"}`;

    const sse = new AgentSseStream(res);
    sse.begin();
    sse.writeStatus("context", "正在加载对话上下文…");

    const prepared = await prepareChatMessage({
      user_id: userId,
      session_id: session_id.trim(),
      message: message.trim(),
      project_id: project_id?.trim() || null,
      novel_id: novel_id?.trim() || null,
    });

    const hooks: PiTurnHooks = {
      onStatus: ({ phase, label }) => sse.writeStatus(phase, label),
      onOutboxDelta: ({ previewText, message_type }) => {
        sse.writeDelta({
          response: previewText,
          partial: true,
          message_type,
          reply: previewText,
        });
      },
      onTrace: ({ label }) => sse.writeStatus("tool", label),
    };

    const turn = await agentManager.novelTurn(userId, session_id.trim(), prepared.enrichedMessage, {
      project_id: prepared.projectId,
      novel_id: prepared.novelId,
      llm,
      hooks,
    });

    sse.writeStatus("persist", "正在保存产出物…");

    const out = turn.outbox || {};
    const effectiveProjectId =
      (typeof out.project_id === "string" && out.project_id) ||
      prepared.projectId ||
      project_id?.trim() ||
      null;

    const payload: OutboxPayload = {
      session_id: session_id.trim(),
      user_id: userId,
      project_id: effectiveProjectId,
      intent: (out.intent as string) || "general_chat",
      agent_name: (out.agent_name as string) || "novel_writer",
      message_type: (out.message_type as string) || "text",
      response: turn.reply || String(out.response || ""),
      artifact_data: out.artifact_data as Record<string, unknown> | undefined,
      novel_data: out.novel_data as Record<string, unknown> | undefined,
      outline_data: out.outline_data as Record<string, unknown> | undefined,
      genre_data: out.genre_data as Record<string, unknown> | undefined,
      scene_data: out.scene_data as Record<string, unknown> | undefined,
      character_data: out.character_data as Record<string, unknown> | undefined,
      script_data: out.script_data as Record<string, unknown> | undefined,
      storyboard_data: out.storyboard_data as Record<string, unknown> | undefined,
      prompt_data: out.prompt_data as Record<string, unknown> | undefined,
      task_list_data: out.task_list_data as Record<string, unknown> | undefined,
    };

    await persistOutbox(payload);
    appendAssistantLog(userId, session_id.trim(), payload.response);

    sse.writeFinal({
      ...payload,
      creator_id: userId,
      llm_profile_id: llm.profileId,
      llm_label: llm.label,
      llm_source: llmResolved.source,
      reply: payload.response,
      panel_mode: mode,
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  }
});

export default router;
