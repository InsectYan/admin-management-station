/**
 * @file _bff.mjs
 * @description Pi 创作工具共用 BFF HTTP 客户端：解析 BFF 基址并发起 GET 请求。
 */

/**
 * 获取 BFF 服务基址。
 * @returns 环境变量 `BFF_URL`，缺省为 `http://localhost:3001`
 */
export function bffBase() {
  return process.env.BFF_URL || "http://localhost:7003";
}

/**
 * 向 BFF 发起 GET 请求并解析 JSON 响应。
 * @param {string} path - API 路径（以 `/` 开头）
 * @returns {Promise<unknown>} 解析后的 JSON 对象
 */
export async function bffGet(path) {
  const r = await fetch(`${bffBase()}${path}`);
  return r.json();
}
