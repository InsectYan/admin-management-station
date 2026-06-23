/**
 * @file load_project.mjs
 * @description 加载单个项目 artifact（Pi tools）
 */
import { bffGet } from "./_bff.mjs";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: node tools/load_project.mjs <project_id>");
  process.exit(1);
}

const userId = process.env.USER_ID || process.env.CREATOR_ID || process.env.ENTITY_ID || "default";
const data = await bffGet(`/api/internal/novel/${userId}/project/${projectId}`);
console.log(JSON.stringify(data, null, 2));
