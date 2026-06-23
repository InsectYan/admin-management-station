import { resolve } from "node:path";
import { config } from "../config.js";

/** Pi 代理角色（小说域）。 */
export type AgentRole = "novel";

export function workspacePath(_role: AgentRole, entityId: string | number): string {
  return resolve(config.workspacesRoot, `novel_${sanitize(entityId)}`);
}

export function sessionDir(role: AgentRole, entityId: string | number, chatSessionId: string): string {
  return resolve(workspacePath(role, entityId), "sessions", sanitize(chatSessionId));
}

export function sessionJsonl(role: AgentRole, entityId: string | number, chatSessionId: string): string {
  return resolve(sessionDir(role, entityId, chatSessionId), "session.jsonl");
}

export function sanitize(id: string | number): string {
  const s = String(id).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  if (!/^[A-Za-z0-9]/.test(s)) return `s_${s}`;
  if (!/[A-Za-z0-9]$/.test(s)) return `${s}_`;
  return s;
}
