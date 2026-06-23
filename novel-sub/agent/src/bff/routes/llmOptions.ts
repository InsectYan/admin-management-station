/**
 * @file llmOptions.ts
 * @description LLM 配置路由：列出可用模型配置档与默认选项。
 */
import { Router } from "express";
import { getDefaultLlmProfileId, listLlmProfiles } from "../../agent/llmProfiles.js";

const router = Router();

/**
 * GET /profiles — 返回全部 LLM 配置档及默认 ID。
 * @param _req - Express 请求（未使用）
 * @param res - Express 响应
 * @returns {void} 无返回值，通过 res 发送 JSON
 */
router.get("/profiles", (_req, res) => {
  const profiles = listLlmProfiles();
  const default_profile_id = getDefaultLlmProfileId();
  res.json({
    profiles,
    default_profile_id,
    default_available: profiles.find((p) => p.id === default_profile_id)?.available ?? false,
  });
});

export default router;
