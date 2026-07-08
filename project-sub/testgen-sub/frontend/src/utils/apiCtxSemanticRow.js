import { normalizeAssertionDetail } from './runResultDetail.js';

/** @param {object} row ft_run_result */
export function parseApiCtxSemanticRow(row) {
  const detail = row?.assertion_detail;
  const { artifacts, assertions } = normalizeAssertionDetail(detail);
  const semantic = (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.semantic)
    || artifacts.semantic
    || null;

  const observationMatch = assertions.find(a => a.type === 'observation_match') || null;
  const contentSkipped = assertions.find(a => a.type === 'content_skipped') || null;
  const functionalFail = (detail && detail.functional_verdict === 'fail')
    || assertions.some(a => a.type === 'submit_business' && a.ok === false)
    || assertions.some(a => a.type === 'turn_status' && a.ok === false)
    || assertions.some(a => a.type === 'poll' && a.ok === false);

  const inputMessage = semantic?.input_message
    || artifacts.inject_message
    || row?.input_summary
    || '—';

  const responseFull = semantic?.response_full
    || artifacts.response_text
    || observationMatch?.actual_excerpt
    || '';

  const responseExcerpt = semantic?.response_excerpt
    || row?.output_summary
    || excerpt(responseFull, 120)
    || '—';

  const confidencePercent = semantic?.confidence_percent
    ?? observationMatch?.confidence_percent
    ?? (observationMatch?.score != null ? toPercent(observationMatch.score) : null);

  const thresholdPercent = semantic?.threshold_percent
    ?? observationMatch?.semantic_threshold_percent
    ?? (observationMatch?.semantic_threshold != null
      ? toPercent(observationMatch.semantic_threshold)
      : null);

  let verdictMode = 'semantic';
  let verdictLabel = '—';
  let verdictType = 'info';

  if (contentSkipped || functionalFail) {
    verdictMode = 'functional';
    verdictLabel = contentSkipped ? '未比对' : '无回复';
    verdictType = 'warning';
  } else if (observationMatch?.pending_judge || observationMatch?.error) {
    verdictMode = 'error';
    verdictLabel = '比对异常';
    verdictType = 'danger';
  } else if (confidencePercent != null) {
    verdictLabel = `${confidencePercent}%`;
    verdictType = row?.sub_verdict === 'pass' ? 'success' : 'danger';
  } else if (row?.sub_verdict === 'pass') {
    verdictLabel = '通过';
    verdictType = 'success';
  } else if (row?.sub_verdict === 'fail') {
    verdictLabel = '未达标';
    verdictType = 'danger';
  }

  return {
    sub_index: row?.sub_index,
    sub_verdict: row?.sub_verdict,
    inputMessage,
    responseExcerpt,
    responseFull,
    confidencePercent,
    thresholdPercent,
    verdictMode,
    verdictLabel,
    verdictType,
    expectedObservation: semantic?.expected_observation || observationMatch?.expected_observation || '',
    reasons: semantic?.reasons || observationMatch?.reasons || [],
    fallback: semantic?.fallback ?? observationMatch?.fallback ?? false,
    functionalVerdict: detail?.functional_verdict ?? row?.functional_verdict,
    httpSummary: artifacts.http_summary || '',
  };
}

/** @param {object[]} results */
export function mapApiCtxSemanticRows(results = []) {
  return results.map(row => ({
    ...row,
    semanticView: parseApiCtxSemanticRow(row),
  }));
}

function excerpt(text, max = 120) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function toPercent(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  const normalized = n > 1 ? n : n * 100;
  return Math.round(normalized * 10) / 10;
}

export function formatSemanticTooltip(view) {
  const lines = [];
  if (view.expectedObservation) {
    lines.push(`期望观测：${view.expectedObservation}`);
  }
  if (view.thresholdPercent != null) {
    lines.push(`语义阈值：${view.thresholdPercent}%`);
  }
  if (view.reasons?.length) {
    lines.push(`判定说明：${view.reasons.join('；')}`);
  }
  if (view.fallback) {
    lines.push('（规则降级估算）');
  }
  if (view.httpSummary) {
    lines.push(`HTTP：${view.httpSummary}`);
  }
  return lines.join('\n');
}
