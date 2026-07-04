'use strict';

const PHASE_STATUS_LABELS = {
  pending: '等待中',
  running: '进行中',
  success: '已完成',
  failed: '已完成',
  cancelled: '已取消',
};

/**
 * @param {object} item
 * @param {object} primaryRun
 * @param {object|null} secondaryRun
 */
function buildSchemePhases(item, primaryRun, secondaryRun = null) {
  const hasSecondary = Boolean(item?.scheme_secondary_id);
  const phases = [
    {
      role: 'primary',
      role_label: '主方案',
      sequence_index: 0,
      scheme_id: primaryRun?.scheme_id || item?.scheme_primary_id,
      scheme_name: item?.scheme_primary_name || null,
      validation_id: primaryRun?.validation_id || item?.validation_primary_id,
      validation_name: item?.validation_primary_name || null,
      run_id: primaryRun?.id ?? null,
      status: primaryRun?.status || 'pending',
      status_label: PHASE_STATUS_LABELS[primaryRun?.status] || PHASE_STATUS_LABELS.pending,
      verdict: primaryRun?.verdict || null,
    },
  ];

  if (hasSecondary) {
    let secStatus = 'pending';
    if (secondaryRun) {
      secStatus = secondaryRun.status;
    } else if (primaryRun && [ 'success', 'failed', 'cancelled' ].includes(primaryRun.status)) {
      secStatus = primaryRun.status === 'success' ? 'pending' : 'cancelled';
    } else if (primaryRun?.status === 'running') {
      secStatus = 'pending';
    }

    phases.push({
      role: 'secondary',
      role_label: '辅方案',
      sequence_index: 1,
      scheme_id: secondaryRun?.scheme_id || item.scheme_secondary_id,
      scheme_name: item?.scheme_secondary_name || null,
      validation_id: secondaryRun?.validation_id || item?.validation_secondary_id,
      validation_name: item?.validation_secondary_name || null,
      run_id: secondaryRun?.id ?? null,
      status: secStatus,
      status_label: PHASE_STATUS_LABELS[secStatus] || PHASE_STATUS_LABELS.pending,
      verdict: secondaryRun?.verdict || null,
    });
  }

  return phases;
}

module.exports = {
  PHASE_STATUS_LABELS,
  buildSchemePhases,
};
