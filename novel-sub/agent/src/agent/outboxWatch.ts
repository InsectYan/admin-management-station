import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import { parseOutboxJson } from "./parseOutboxJson.js";
import { extractOutboxPreviewText, outboxHasPreviewContent } from "./outboxPreview.js";

export interface OutboxReadyPayload {
  outbox: Record<string, unknown>;
  reply: string;
  previewText: string;
}

function tryParseOutboxRaw(raw: string): { outbox: Record<string, unknown> } | null {
  try {
    return { outbox: parseOutboxJson(raw) };
  } catch {
    return null;
  }
}

/** 监听 Pi write outbox.json；JSON 可解析且含 preview 时回调（可多次，随 outbox 更新推送）。 */
export function watchOutboxReady(
  outboxPath: string,
  onReady: (payload: OutboxReadyPayload) => void,
): () => void {
  let lastPreview = "";
  let dirWatcher: FSWatcher | undefined;

  const tryRead = (): void => {
    if (!existsSync(outboxPath)) return;
    try {
      const raw = readFileSync(outboxPath, "utf-8");
      if (!raw.trim()) return;
      const parsed = tryParseOutboxRaw(raw);
      if (!parsed) return;
      const outbox = parsed.outbox;
      if (!outboxHasPreviewContent(outbox)) return;
      const previewText = extractOutboxPreviewText(outbox);
      if (previewText === lastPreview) return;
      lastPreview = previewText;
      const reply = String(outbox.reply ?? outbox.response ?? "").trim();
      onReady({ outbox, reply, previewText });
    } catch {
      /* 半写或非法 JSON */
    }
  };

  const dir = dirname(outboxPath);
  const fileName = basename(outboxPath);
  try {
    dirWatcher = watch(dir, (_event, name) => {
      if (name == null || name === fileName) tryRead();
    });
  } catch {
    /* 目录不存在时 materializeTurn 会创建；轮询兜底 */
  }

  const poll = setInterval(tryRead, 400);
  tryRead();

  return () => {
    dirWatcher?.close();
    clearInterval(poll);
  };
}
