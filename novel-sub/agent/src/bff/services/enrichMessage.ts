import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../../config.js";

function chatLogPath(userId: string, sessionId: string): string {
  return resolve(config.dataRoot, "novel", userId, "chat_logs", `${sessionId}.jsonl`);
}

function appendChatLog(userId: string, sessionId: string, role: string, content: string): void {
  const p = chatLogPath(userId, sessionId);
  mkdirSync(resolve(p, ".."), { recursive: true });
  const line = JSON.stringify({ role, content, ts: new Date().toISOString() }) + "\n";
  if (existsSync(p)) {
    writeFileSync(p, readFileSync(p, "utf-8") + line, "utf-8");
  } else {
    writeFileSync(p, line, "utf-8");
  }
}

function loadRecentHistory(userId: string, sessionId: string, maxLines = 12): string {
  const p = chatLogPath(userId, sessionId);
  if (!existsSync(p)) return "";
  const lines = readFileSync(p, "utf-8").trim().split("\n").filter(Boolean);
  const recent = lines.slice(-maxLines);
  if (!recent.length) return "";
  const blocks = recent.map((l) => {
    try {
      const row = JSON.parse(l) as { role?: string; content?: string };
      return `- **${row.role || "user"}**: ${(row.content || "").slice(0, 500)}`;
    } catch {
      return "";
    }
  });
  return `## 近期对话\n\n${blocks.filter(Boolean).join("\n")}\n\n`;
}

export interface PreparedChatMessage {
  enrichedMessage: string;
  userContentToStore: string;
  projectId: string | null;
  novelId: string | null;
}

export async function prepareChatMessage(input: {
  user_id: string;
  session_id: string;
  message: string;
  project_id?: string | null;
  novel_id?: string | null;
}): Promise<PreparedChatMessage> {
  const history = loadRecentHistory(input.user_id, input.session_id);
  const projectBlock = input.project_id
    ? `## 当前项目\n\nproject_id: \`${input.project_id}\`\n\n`
    : "## 当前项目\n\n（未绑定项目）\n\n";
  const novelBlock = input.novel_id
    ? `## 当前小说\n\nnovel_id: \`${input.novel_id}\`\n\n`
    : "";

  const enriched = [
    history,
    projectBlock,
    novelBlock,
    "## 当前消息\n\n",
    input.message.trim(),
  ].join("");

  appendChatLog(input.user_id, input.session_id, "user", input.message.trim());

  return {
    enrichedMessage: enriched,
    userContentToStore: input.message.trim(),
    projectId: input.project_id ?? null,
    novelId: input.novel_id ?? null,
  };
}

export function appendAssistantLog(userId: string, sessionId: string, content: string): void {
  appendChatLog(userId, sessionId, "assistant", content);
}
