'use strict';

/**
 * 将用例的「最新主执行 ID」写回 test_item_detail.latest_ft_run_id。
 * 仅主 run（无 parent / sequence_index=0）应调用；辅方案子 run 不要调用。
 *
 * @param {import('egg').Application|import('egg').Context} appOrCtx
 * @param {string} itemId
 * @param {number|string} ftRunId
 */
async function touchItemLatestFtRunId(appOrCtx, itemId, ftRunId) {
  if (!itemId || ftRunId == null || ftRunId === '') return;
  const runId = Number(ftRunId);
  if (!Number.isFinite(runId) || runId <= 0) return;

  const model = appOrCtx.model || appOrCtx.app?.model;
  if (!model?.query) return;

  await model.query(
    `UPDATE test_item_detail
     SET latest_ft_run_id = :runId, updated_at = NOW()
     WHERE item_id = :itemId AND is_active = TRUE`,
    { replacements: { itemId: String(itemId), runId } },
  );
}

module.exports = { touchItemLatestFtRunId };
