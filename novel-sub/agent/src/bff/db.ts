/**
 * @file db.ts
 * @description PostgreSQL 连接池与健康检查：提供全局 `pool` 实例及数据库连通性探测。
 */

import pg from "pg";
import { config } from "../config.js";

/** PostgreSQL 连接池，供 BFF 各 Store 模块复用。 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 2_000,
});

/**
 * 检测数据库是否可用（带 2 秒超时）。
 * @returns 连接成功且查询返回结果时为 `true`，否则为 `false`
 */
export async function dbHealth(): Promise<boolean> {
  try {
    const result = await Promise.race([
      pool.query("SELECT 1"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db health timeout")), 2_000),
      ),
    ]);
    return !!result;
  } catch {
    return false;
  }
}
