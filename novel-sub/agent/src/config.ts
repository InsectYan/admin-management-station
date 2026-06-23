import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentRoot = resolve(__dirname, "..");
const appRoot = resolve(agentRoot, "..");

dotenv.config({ path: resolve(agentRoot, ".env") });
dotenv.config({ path: resolve(appRoot, ".env") });

export const config = {
  port: Number(process.env.PORT || process.env.NOVEL_AGENT_PORT || "7003"),
  bffPublicUrl:
    process.env.BFF_URL ||
    `http://localhost:${process.env.PORT || process.env.NOVEL_AGENT_PORT || "7003"}`,
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://admin:admin123@127.0.0.1:5433/novel_db",
  templatesRoot: process.env.TEMPLATES_ROOT || resolve(appRoot, "workspace-templates"),
  workspacesRoot: process.env.WORKSPACES_ROOT || resolve(appRoot, "workspaces"),
  dataRoot: process.env.DATA_ROOT || resolve(appRoot, "data"),
  novelBffUrl: process.env.NOVEL_BFF_URL || "http://localhost:7002",
  appRoot,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174",
  llm: (() => {
    const provider = (process.env.LLM_PROVIDER || "ollama").trim().toLowerCase();
    const openaiKey = (process.env.OPENAI_API_KEY || "ollama").trim();
    const zhipuKey = (process.env.ZHIPU_API_KEY || "").trim();
    const deepseekKey = (process.env.DEEPSEEK_API_KEY || "").trim();
    const ollamaBase = (process.env.OLLAMA_BASE_URL || process.env.BASE_URL || "http://localhost:11434/v1").trim();
    const ollamaModel = (process.env.OLLAMA_MODEL || "qwen3.6:latest").trim();

    if (provider === "ollama" || (!zhipuKey && !deepseekKey && ollamaBase)) {
      return {
        provider: "ollama",
        baseUrl: ollamaBase,
        model: ollamaModel,
        apiKey: openaiKey || "ollama",
      };
    }
    if (provider === "deepseek" && deepseekKey) {
      return {
        provider: "deepseek",
        baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        model: process.env.LLM_MODEL_NAME || "deepseek-chat",
        apiKey: deepseekKey,
      };
    }
    if (provider === "zhipu" && zhipuKey) {
      return {
        provider: "zhipu",
        baseUrl: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
        model: process.env.ZHIPU_LLM_MODEL || "glm-4-flash",
        apiKey: zhipuKey,
      };
    }
    return {
      provider: "openai",
      baseUrl: process.env.BASE_URL || "https://api.openai.com/v1",
      model: process.env.LLM_MODEL_NAME || "gpt-4o-mini",
      apiKey: openaiKey,
    };
  })(),
};
