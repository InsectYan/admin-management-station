/** 发版放行标准（向导创建时写入计划 notes，详情/报告页展示） */
export const RELEASE_CRITERIA = [
  'P0 阻塞项自动化覆盖率须达到计划阈值（默认 ≥ 95%）',
  '风险防护项无 GAP 状态（已覆盖或部分覆盖可接受）',
  'PRD 目标关联用例通过率 ≥ 计划阈值',
  '发版信号为 GREEN 或 YELLOW（RED 需豁免审批）',
  '计划内所有 P0 用例执行 verdict 为 pass，或已登记已知缺陷',
];

/** @param {string|null|undefined} notes */
export function parsePlanMeta(notes) {
  if (!notes) return { release_criteria: RELEASE_CRITERIA };
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed.release_criteria)) return parsed;
  } catch {
    /* 非 JSON 则回退默认 */
  }
  return { release_criteria: RELEASE_CRITERIA };
}

export function serializePlanMeta(meta) {
  return JSON.stringify(meta);
}

/** 阈值参数默认值 */
export const THRESHOLD_DEFAULTS = {
  rate_L: 90,
  rate_M: 95,
  rate_H: 98,
  passk_N: 3,
  passk_M: 2,
  block_L: 10,
  block_M: 5,
  block_H: 1,
  submit_p99_ms_L: 3000,
  submit_p99_ms_M: 2000,
  ttft_ms_M: 1500,
  error_rate_H: 1,
  reviewer_count: 3,
};
