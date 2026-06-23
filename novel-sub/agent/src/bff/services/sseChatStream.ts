/**
 * @file sseChatStream.ts
 * @description 创作端聊天 SSE 流（对齐 fitness-agent AgentSseStream 契约）。
 */
import type { Response } from "express";
import { randomUUID } from "node:crypto";

export const SSE_MESSAGE_SCHEMA_VERSION = 1;

/** @deprecated 使用 status 事件 */
export interface ChatProgressPayload {
  stage: string;
  label: string;
}

/** 创作端 Agent SSE 写入器。 */
export class AgentSseStream {
  private headersSent = false;
  private ended = false;
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(private readonly res: Response) {}

  begin(): void {
    if (this.headersSent || this.ended) return;
    this.res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    this.res.setHeader("Cache-Control", "no-cache, no-transform");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
    this.res.flushHeaders?.();
    this.headersSent = true;
    this.heartbeat = setInterval(() => {
      if (!this.ended) this.res.write(`: keepalive ${Date.now()}\n\n`);
    }, 15_000);
  }

  writeStatus(phase: string, label: string): void {
    if (!this.headersSent) this.begin();
    this.writeEvent("status", { phase, label });
    this.writeEvent("progress", { stage: phase, label });
  }

  writeDelta(payload: {
    response: string;
    partial: true;
    message_type?: string;
    reply?: string;
  }): void {
    if (!this.headersSent) this.begin();
    this.writeEvent("delta", payload);
  }

  writeFinal(messageBody: Record<string, unknown>): void {
    if (!this.headersSent) this.begin();
    const id = randomUUID();
    this.writeRaw(id, "message", {
      ...messageBody,
      schema_version: SSE_MESSAGE_SCHEMA_VERSION,
      partial: false,
      final: true,
    });
    this.writeRaw(id, "done", "[DONE]");
    this.close();
  }

  writeError(message: string): void {
    if (!this.headersSent) this.begin();
    this.writeEvent("error", { message });
    const id = randomUUID();
    this.writeRaw(id, "done", "[DONE]");
    this.close();
  }

  private writeEvent(event: string, data: Record<string, unknown>): void {
    if (this.ended) return;
    this.writeRaw(randomUUID(), event, data);
  }

  private writeRaw(id: string, event: string, data: unknown): void {
    if (this.ended) return;
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.res.write(`id: ${id}\nevent: ${event}\ndata: ${payload}\n\n`);
    const flush = (this.res as Response & { flush?: () => void }).flush;
    flush?.call(this.res);
  }

  private close(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    if (!this.ended) {
      this.ended = true;
      this.res.end();
    }
  }
}

/** @deprecated 使用 AgentSseStream */
export function initSseChatStream(res: Response) {
  const sse = new AgentSseStream(res);
  sse.begin();
  return {
    progress(stage: string, label: string) {
      sse.writeStatus(stage, label);
    },
    finish(body: Record<string, unknown>) {
      sse.writeFinal(body);
    },
  };
}
