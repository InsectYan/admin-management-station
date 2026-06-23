import { readdirSync, statSync } from "node:fs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

function artifactDir(userId: string, projectId: string): string {
  return resolve(config.dataRoot, "novel", userId, "projects", projectId, "artifacts");
}

export function ensureProjectDir(userId: string, projectId: string): void {
  mkdirSync(artifactDir(userId, projectId), { recursive: true });
}

export function saveArtifact(
  userId: string,
  projectId: string,
  key: string,
  data: Record<string, unknown>,
): void {
  ensureProjectDir(userId, projectId);
  const file = resolve(artifactDir(userId, projectId), `${key}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export function loadArtifact(
  userId: string,
  projectId: string,
  key: string,
): Record<string, unknown> | null {
  const file = resolve(artifactDir(userId, projectId), `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function listProjects(userId: string): Array<{ id: string; title: string }> {
  const root = resolve(config.dataRoot, "novel", userId, "projects");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => {
      try {
        return statSync(resolve(root, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((id) => {
      const meta = loadArtifact(userId, id, "meta");
      return { id, title: String(meta?.title || id) };
    });
}

export function loadProject(userId: string, projectId: string): Record<string, unknown> | null {
  const root = resolve(config.dataRoot, "novel", userId, "projects", projectId);
  if (!existsSync(root)) return null;
  const meta = loadArtifact(userId, projectId, "meta") || { title: projectId };
  const artifacts: Record<string, unknown> = {};
  const dir = artifactDir(userId, projectId);
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const key = file.replace(/\.json$/, "");
      const data = loadArtifact(userId, projectId, key);
      if (data) artifacts[key] = data;
    }
  }
  return {
    id: projectId,
    title: meta.title,
    artifacts,
  };
}
