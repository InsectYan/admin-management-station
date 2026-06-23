import { existsSync, readFileSync, renameSync } from "node:fs";

export function extractLastPiLlmError(jsonlPath: string): string | null {
  if (!existsSync(jsonlPath)) return null;
  try {
    const lines = readFileSync(jsonlPath, "utf-8").trim().split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const row = JSON.parse(lines[i]!) as {
        type?: string;
        message?: { stopReason?: string; errorMessage?: string };
      };
      if (row.type === "message" && row.message?.stopReason === "error") {
        return row.message.errorMessage?.trim() || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function replyForNoOutbox(llmError: string | null): string {
  if (!llmError) {
    return "本轮助手未完成结构化输出（未生成 outbox.json），请重新发送您的需求。";
  }
  const lower = llmError.toLowerCase();
  if (lower.includes("429") || lower.includes("quota")) {
    return "模型 API 配额不足或限流，请切换其他模型或稍后重试。";
  }
  if (lower.includes("401") || (lower.includes("invalid") && lower.includes("api"))) {
    return "模型 API 密钥无效或未配置，请检查 agent-server/.env 后重启服务。";
  }
  if (lower.includes("connection") || lower.includes("econnrefused")) {
    return "无法连接本地 Ollama，请确认 Ollama 已启动且 OLLAMA_BASE_URL 正确。";
  }
  return `模型调用失败：${llmError.slice(0, 200)}`;
}

export function buildCreatorNoOutboxFallback(llmError?: string | null): Record<string, unknown> {
  return {
    reply: replyForNoOutbox(llmError ?? null),
    message_type: "text",
    intent: "general_chat",
    agent_name: "novel_writer",
  };
}

export function archiveSessionJsonlIfPresent(jsonlPath: string): void {
  try {
    if (!existsSync(jsonlPath)) return;
    renameSync(jsonlPath, `${jsonlPath}.bak.${Date.now()}`);
  } catch {
    /* non-fatal */
  }
}
