import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import type { AgentRole } from "./paths.js";
import { workspacePath } from "./paths.js";

function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

function renderMd(path: string, vars: Record<string, string>): void {
  if (!existsSync(path)) return;
  let text = readFileSync(path, "utf-8");
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, v);
  }
  writeFileSync(path, text, "utf-8");
}

export function initWorkspace(
  role: AgentRole,
  entityId: string | number,
  vars: Record<string, string> = {},
): string {
  const dest = workspacePath(role, entityId);
  const marker = resolve(dest, ".pi_initialized");
  if (existsSync(marker)) {
    renderMd(resolve(dest, "USER.md"), vars);
    return dest;
  }

  const tpl = resolve(config.templatesRoot, role);
  mkdirSync(config.workspacesRoot, { recursive: true });
  copyDir(tpl, dest);
  mkdirSync(resolve(dest, "sessions"), { recursive: true });
  mkdirSync(resolve(dest, "projects"), { recursive: true });

  const allVars = {
    ENTITY_ID: String(entityId),
    USER_ID: String(entityId),
    CREATOR_ID: String(entityId),
    ROLE: role,
    ...vars,
  };
  for (const name of ["SOUL.md", "AGENTS.md", "USER.md", "MEMORY.md"]) {
    renderMd(resolve(dest, name), allVars);
  }

  const envLines = [
    `BFF_URL=${process.env.BFF_URL || config.bffPublicUrl}`,
    `ROLE=${role}`,
    `ENTITY_ID=${entityId}`,
    `USER_ID=${entityId}`,
    `CREATOR_ID=${entityId}`,
  ];
  writeFileSync(resolve(dest, ".env"), envLines.join("\n") + "\n", "utf-8");
  writeFileSync(marker, new Date().toISOString(), "utf-8");
  return dest;
}
