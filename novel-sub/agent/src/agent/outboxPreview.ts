/** 从 Pi outbox 提取可在 delta 阶段展示的预览正文。 */
export function extractOutboxPreviewText(outbox: Record<string, unknown>): string {
  const reply = String(outbox.reply ?? outbox.response ?? "").trim();
  const messageType = typeof outbox.message_type === "string" ? outbox.message_type : "";

  const pickLonger = (candidate: string): string => {
    const t = candidate.trim();
    return t.length > reply.length ? t : reply;
  };

  const artifact = outbox.artifact_data;
  if (artifact && typeof artifact === "object") {
    const content = String((artifact as Record<string, unknown>).content ?? "").trim();
    if (content) return pickLonger(content);
  }

  for (const key of [
    "novel_data",
    "outline_data",
    "genre_data",
    "scene_data",
    "character_data",
    "script_data",
    "storyboard_data",
    "prompt_data",
  ] as const) {
    const data = outbox[key];
    if (!data || typeof data !== "object") continue;
    const body = String((data as Record<string, unknown>).content ?? "").trim();
    if (body) return pickLonger(body);
    if (messageType === "script" || key === "script_data") {
      const scriptText = String((data as Record<string, unknown>).script_text ?? "").trim();
      if (scriptText) return pickLonger(scriptText);
    }
  }

  return reply;
}

export function outboxHasPreviewContent(outbox: Record<string, unknown>): boolean {
  return extractOutboxPreviewText(outbox).trim().length > 0;
}
