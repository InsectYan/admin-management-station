/**
 * @file llmChat.ts
 * @description LLM 聊天封装：OpenAI 兼容 API 的 JSON 与纯文本补全。
 */
import { jsonrepair } from "jsonrepair";
import type { LlmRuntimeConfig } from "../../agent/llmProfiles.js";

/**
 * 从 LLM 回复文本中解析 JSON 对象（支持 markdown 代码块与 jsonrepair）。
 * @param {string} text - 原始回复文本
 * @returns {Record<string, unknown>} 解析后的 JSON 对象
 */
function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1]!.trim() : trimmed;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return JSON.parse(jsonrepair(raw)) as Record<string, unknown>;
  }
}

/**
 * 从流式 JSON 片段中提取指定字符串字段的可读前缀（用于 assistant_reply 实时展示）。
 */
function extractPartialJsonStringField(buffer: string, field: string): string {
  const marker = `"${field}"`;
  const idx = buffer.indexOf(marker);
  if (idx < 0) return "";
  let i = idx + marker.length;
  while (i < buffer.length && /[\s:]/.test(buffer[i]!)) i += 1;
  if (buffer[i] !== '"') return "";
  i += 1;
  let out = "";
  while (i < buffer.length) {
    const ch = buffer[i]!;
    if (ch === '"') break;
    if (ch === "\\" && i + 1 < buffer.length) {
      const esc = buffer[i + 1]!;
      if (esc === "n") out += "\n";
      else if (esc === "t") out += "\t";
      else if (esc === "r") out += "\r";
      else out += esc;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * 调用 LLM 并期望返回 JSON 对象（response_format: json_object）。
 * 可选 onDelta：流式推送 assistant_reply 字段内容。
 */
export async function llmChatJson(
  llm: LlmRuntimeConfig,
  system: string,
  user: string,
  opts?: { onDelta?: (text: string) => void },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model: llm.model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (opts?.onDelta) body.stream = true;

  const res = await fetch(`${llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${res.status}: ${errText.slice(0, 200)}`);
  }

  if (!opts?.onDelta) {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("LLM empty response");
    return parseJsonObject(content);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("LLM stream unavailable");
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let lastPreview = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) content += delta;
      } catch {
        /* ignore */
      }
    }
    const preview = extractPartialJsonStringField(content, "assistant_reply");
    if (preview && preview !== lastPreview) {
      lastPreview = preview;
      opts.onDelta(preview);
    }
  }

  if (!content.trim()) throw new Error("LLM empty response");
  return parseJsonObject(content);
}

/**
 * 调用 LLM 并返回纯文本回复。
 * @param {LlmRuntimeConfig} llm - LLM 运行时配置
 * @param {string} system - 系统提示词
 * @param {string} user - 用户消息
 * @returns {Promise<string>} 助手回复文本
 */
export async function llmChatText(
  llm: LlmRuntimeConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(`${llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}
