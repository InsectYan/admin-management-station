/**
 * @file list_projects.mjs
 * @description 列出当前用户项目（Pi tools → agent-server internal API）
 */
import { bffGet } from "./_bff.mjs";

const userId = process.env.USER_ID || process.env.CREATOR_ID || process.env.ENTITY_ID || "default";
const data = await bffGet(`/api/internal/novel/${userId}/projects`);
console.log(JSON.stringify(data, null, 2));
