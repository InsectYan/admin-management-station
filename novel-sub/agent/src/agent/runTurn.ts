import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AuthStorage,
  createAgentSession,
  type AgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { config } from "../config.js";
import {
  archiveSessionJsonlIfPresent,
  buildCreatorNoOutboxFallback,
  extractLastPiLlmError,
} from "./turnFallback.js";
import { parseOutboxJson } from "./parseOutboxJson.js";
import { watchOutboxReady } from "./outboxWatch.js";
import { initWorkspace } from "./workspaceInit.js";
import type { AgentRole } from "./paths.js";
import { sessionDir, sessionJsonl, sanitize, workspacePath } from "./paths.js";
import type { LlmRuntimeConfig } from "./llmProfiles.js";
import { resolveChatModel } from "./model.js";

export interface PiTurnHooks {
  onStatus?: (payload: { phase: string; label: string; tool?: string }) => void;
  onOutboxDelta?: (payload: {
    reply: string;
    previewText: string;
    message_type?: string;
    outbox: Record<string, unknown>;
  }) => void;
  onTrace?: (payload: { step: number; kind: string; tool?: string; label: string }) => void;
}

export interface TurnInput {
  role: AgentRole;
  entityId: string | number;
  chatSessionId: string;
  message: string;
  context?: Record<string, unknown>;
  llm?: LlmRuntimeConfig;
  hooks?: PiTurnHooks;
}

export interface TurnOutput {
  reply: string;
  outbox?: Record<string, unknown>;
  workspace: string;
  session_dir: string;
}

function buildAuth(llm?: LlmRuntimeConfig) {
  const data: Record<string, { type: "api_key"; key: string }> = {};
  const key = (llm?.apiKey ?? config.llm.apiKey).trim();
  if (key) {
    data.openai = { type: "api_key", key };
    data.zhipu = { type: "api_key", key };
  }
  const authStorage = AuthStorage.inMemory(data);
  return { authStorage, modelRegistry: ModelRegistry.create(authStorage) };
}

function userRequestsMemoryPersist(line: string): boolean {
  return /记住|记一下|偏好|以后都|风格偏好|请记/.test(line);
}

function extractCurrentLine(enriched: string): string {
  const m = /(?:^|\n)## 当前消息\r?\n/.exec(enriched);
  if (!m) return enriched.trim().slice(0, 2000);
  const tail = enriched.slice(m.index + m[0].length);
  const nextSec = tail.search(/\r?\n## /);
  const block = nextSec >= 0 ? tail.slice(0, nextSec) : tail;
  const skip = /^(project_id|novel_id|用户|会话|##|-\s)/;
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || skip.test(t)) continue;
    return t.slice(0, 2000);
  }
  return block.trim().slice(0, 2000);
}

async function waitSessionIdle(session: AgentSession): Promise<void> {
  while (session.isStreaming) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function promptAndWait(session: AgentSession, text: string): Promise<void> {
  await session.prompt(text, { expandPromptTemplates: false });
  await waitSessionIdle(session);
}

function toolStatusLabel(toolName: string): string | null {
  if (toolName === "read") return "正在读取资料…";
  if (toolName === "grep") return "正在检索工作区…";
  if (toolName === "bash") return "正在查询小说数据…";
  if (toolName === "write") return "正在撰写回复…";
  return null;
}

export function materializeTurn(input: TurnInput): { cwd: string; session_dir: string; outbox_path: string } {
  const cwd = workspacePath(input.role, input.entityId);
  const dir = sessionDir(input.role, input.entityId, input.chatSessionId);
  mkdirSync(dir, { recursive: true });

  const outbox = resolve(dir, "outbox.json");
  if (existsSync(outbox)) unlinkSync(outbox);

  writeFileSync(resolve(dir, "inbox.md"), input.message, "utf-8");
  writeFileSync(
    resolve(dir, "context.json"),
    JSON.stringify(
      {
        role: input.role,
        entity_id: input.entityId,
        user_id: input.entityId,
        chat_session_id: input.chatSessionId,
        ...input.context,
      },
      null,
      2,
    ),
    "utf-8",
  );
  writeFileSync(
    resolve(dir, "PROMPT.md"),
    `# 本轮\n\n必须 write outbox.json（含 reply）。\n`,
    "utf-8",
  );

  return { cwd, session_dir: dir, outbox_path: outbox };
}

export async function runPiTurn(input: TurnInput): Promise<TurnOutput> {
  initWorkspace(input.role, input.entityId);
  const { cwd, session_dir, outbox_path } = materializeTurn(input);

  const activeLlm = input.llm;
  const apiKey = (activeLlm?.apiKey ?? config.llm.apiKey).trim();
  if (!apiKey) {
    const stub: Record<string, unknown> = {
      reply:
        "【开发模式】未配置模型 API Key / Ollama。请在 novel-sub/agent/.env 配置 OLLAMA_BASE_URL 或 OPENAI_API_KEY 后重启。",
      message_type: "text",
      intent: "general_chat",
      agent_name: "novel_writer",
    };
    writeFileSync(outbox_path, JSON.stringify(stub, null, 2), "utf-8");
    return { reply: String(stub.reply), outbox: stub, workspace: cwd, session_dir };
  }

  const jsonlPath = sessionJsonl(input.role, input.entityId, input.chatSessionId);
  const rel = session_dir.slice(cwd.length).replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const outboxRel = `${rel}/outbox.json`;
  const currentLine = extractCurrentLine(input.message);
  const shouldPersistMemory = userRequestsMemoryPersist(currentLine);

  let sessionManager: SessionManager;
  if (existsSync(jsonlPath)) {
    sessionManager = SessionManager.open(jsonlPath, session_dir, cwd);
  } else {
    sessionManager = SessionManager.create(cwd, session_dir, {
      id: sanitize(input.chatSessionId),
    });
    sessionManager.setSessionFile(jsonlPath);
  }

  const { authStorage, modelRegistry } = buildAuth(activeLlm);
  const { session } = await createAgentSession({
    cwd,
    sessionManager,
    settingsManager: SettingsManager.create(cwd),
    authStorage,
    modelRegistry,
    model: resolveChatModel(activeLlm),
    tools: ["read", "grep", "bash", "write"],
    thinkingLevel: "off",
    sessionStartEvent: {
      type: "session_start",
      reason: existsSync(jsonlPath) ? "resume" : "startup",
    },
  });

  const novelBlock = `
【创作本轮原话】${currentLine}

本轮结束前必须 write ${outboxRel}（合法 JSON）。查小说/素材用 bash node tools/<名>.mjs（见 AGENTS.md）。
必填：reply、message_type、intent、agent_name。
按任务类型 read 对应 *-format.md；结构化正文放入 artifact_data / 对应 *_data 字段。
${shouldPersistMemory ? "用户要求记住偏好：须 write 更新 MEMORY.md。" : ""}
`;

  const mainPrompt = [
    `【novel】entity=${input.entityId} session=${input.chatSessionId}`,
    activeLlm ? `【模型场景】${activeLlm.label} (${activeLlm.model})` : "",
    novelBlock,
    `1. read SOUL.md 与 AGENTS.md`,
    `2. read MEMORY.md（若有长期偏好）`,
    `3. read ${rel}/inbox.md 与 context.json`,
    `4. 需要数据：bash node tools/xxx.mjs（见 AGENTS.md）`,
    `5. write ${outboxRel} — 完成后再结束`,
  ].join("\n");

  input.hooks?.onStatus?.({ phase: "pi_turn", label: "正在执行 AI 创作任务…" });

  let traceStep = 0;
  const unsubSession = session.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      const label = toolStatusLabel(event.toolName);
      if (label) {
        traceStep += 1;
        input.hooks?.onTrace?.({ step: traceStep, kind: "tool", tool: event.toolName, label });
        input.hooks?.onStatus?.({ phase: "tool", label, tool: event.toolName });
      }
    }
  });

  const stopOutboxWatch = input.hooks?.onOutboxDelta
    ? watchOutboxReady(outbox_path, ({ outbox, reply, previewText }) => {
        input.hooks?.onOutboxDelta?.({
          reply,
          previewText,
          message_type: typeof outbox.message_type === "string" ? outbox.message_type : undefined,
          outbox,
        });
      })
    : () => {};

  try {
    await promptAndWait(session, mainPrompt);

    for (let attempt = 0; attempt < 2 && !existsSync(outbox_path); attempt++) {
      input.hooks?.onStatus?.({ phase: "pi_turn", label: "正在补写回复…" });
      await promptAndWait(
        session,
        `【强制补写 attempt=${attempt + 1}】仍未检测到 ${outboxRel}。请立刻 write 该 JSON 文件，按 AGENTS.md 填写 message_type 与 agent_name。`,
      );
    }
  } finally {
    unsubSession();
    stopOutboxWatch();
  }

  session.dispose();

  let usedFallback = false;
  if (!existsSync(outbox_path)) {
    const llmError = extractLastPiLlmError(jsonlPath);
    const fallback = buildCreatorNoOutboxFallback(llmError);
    writeFileSync(outbox_path, JSON.stringify(fallback, null, 2), "utf-8");
    usedFallback = true;
  }

  if (usedFallback) {
    archiveSessionJsonlIfPresent(jsonlPath);
  }

  let outbox: Record<string, unknown>;
  try {
    outbox = parseOutboxJson(readFileSync(outbox_path, "utf-8"));
  } catch (e) {
    const parseMsg = e instanceof Error ? e.message : String(e);
    console.warn(`[runTurn] invalid outbox.json: ${parseMsg}`);
    outbox = buildCreatorNoOutboxFallback(extractLastPiLlmError(jsonlPath));
    outbox.reply = `助手输出的 outbox.json 格式无效（${parseMsg.slice(0, 120)}），请重试或缩短单次生成长度。`;
  }

  return {
    reply: String(outbox.reply || outbox.response || ""),
    outbox,
    workspace: cwd,
    session_dir,
  };
}
