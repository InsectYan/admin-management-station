import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runDbMigrations } from "./bff/dbMigrations.js";
import chatRouter from "./bff/routes/chat.js";
import internalRouter from "./bff/routes/internal.js";
import llmOptionsRouter from "./bff/routes/llmOptions.js";
import { dbHealth } from "./bff/db.js";

async function main() {
  await runDbMigrations();

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", async (_req, res) => {
    const dbOk = await dbHealth();
    res.json({
      status: "ok",
      runtime: "novel-sub-agent-pi-v3",
      app_key: "agent",
      database: dbOk ? "connected" : "disconnected",
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "novel-sub-agent",
      version: "1.0.0",
      architecture: "BFF + Pi workspaces (novel domain)",
    });
  });

  app.use("/api/chat", chatRouter);
  app.use("/api/llm", llmOptionsRouter);
  app.use("/api/internal", internalRouter);

  app.listen(config.port, () => {
    console.log(`[agent-server] listening on :${config.port}`);
    console.log(`[agent-server] templates: ${config.templatesRoot}`);
    console.log(`[agent-server] workspaces: ${config.workspacesRoot}`);
    console.log(`[agent-server] data: ${config.dataRoot}`);
    console.log(`[agent-server] database: ${config.databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
