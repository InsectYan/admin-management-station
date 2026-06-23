/**
 * @file parseOutboxJson.ts
 * @description 解析 Pi 写入的 outbox.json，支持 strict parse 失败时的 jsonrepair 修复。
 */
import { jsonrepair } from "jsonrepair";

/**
 * 解析 outbox.json 文本为对象；Pi 输出常含未转义引号，失败时尝试 repair。
 * @param raw - outbox.json 原始字符串
 * @returns 解析后的键值对象
 * @throws 空内容或 strict/repair 均失败时抛出 SyntaxError
 */
export function parseOutboxJson(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) {
    throw new SyntaxError("outbox.json is empty");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (strictErr) {
    try {
      return JSON.parse(jsonrepair(text)) as Record<string, unknown>;
    } catch {
      throw strictErr;
    }
  }
}
