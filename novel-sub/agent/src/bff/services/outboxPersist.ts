import { ensureProjectDir, saveArtifact } from "../artifactStore.js";

export interface OutboxPayload {
  session_id: string;
  user_id: string;
  project_id?: string | null;
  intent: string;
  agent_name: string;
  message_type: string;
  response: string;
  artifact_data?: Record<string, unknown>;
  novel_data?: Record<string, unknown>;
  outline_data?: Record<string, unknown>;
  genre_data?: Record<string, unknown>;
  scene_data?: Record<string, unknown>;
  character_data?: Record<string, unknown>;
  script_data?: Record<string, unknown>;
  storyboard_data?: Record<string, unknown>;
  prompt_data?: Record<string, unknown>;
  task_list_data?: Record<string, unknown>;
}

const TYPE_TO_ARTIFACT: Record<string, string> = {
  novel: "novel",
  novel_outline: "outline",
  genre_analysis: "genre",
  scene_analysis: "scene",
  character_analysis: "character",
  script: "script",
  storyboard: "storyboard",
  prompt_pack: "prompts",
  task_list: "tasks",
};

export async function persistOutbox(payload: OutboxPayload): Promise<{ saved: boolean }> {
  const projectId = payload.project_id?.trim();
  if (!projectId) return { saved: false };

  ensureProjectDir(payload.user_id, projectId);

  const mt = payload.message_type || "text";
  const key = TYPE_TO_ARTIFACT[mt];
  if (!key) return { saved: false };

  const data =
    payload.artifact_data ||
    payload.novel_data ||
    payload.outline_data ||
    payload.genre_data ||
    payload.scene_data ||
    payload.character_data ||
    payload.script_data ||
    payload.storyboard_data ||
    payload.prompt_data ||
    payload.task_list_data;

  if (!data || typeof data !== "object") return { saved: false };

  saveArtifact(payload.user_id, projectId, key, {
    ...data,
    intent: payload.intent,
    agent_name: payload.agent_name,
    message_type: mt,
    saved_at: new Date().toISOString(),
  });

  return { saved: true };
}
