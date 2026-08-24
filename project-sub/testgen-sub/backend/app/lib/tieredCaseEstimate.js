'use strict';

/**
 * 与 testgen-skill caseCountEstimator 对齐的分层估算（BFF 启发式 / Agent 回落）
 * 正常≈每接口1条；异常抽样；并发/性能仅少数代表性接口
 */

const ESTIMATE_MAX_TOTAL = Number(process.env.TESTGEN_ESTIMATE_MAX_TOTAL || 8000);
const ERROR_SAMPLE_RATIO = Number(process.env.TESTGEN_ESTIMATE_ERROR_RATIO || 0.35);
const ERROR_SAMPLE_MIN = Number(process.env.TESTGEN_ESTIMATE_ERROR_MIN || 3);
const PERF_SAMPLE_MAX = Number(process.env.TESTGEN_ESTIMATE_PERF_MAX || 5);
const PERF_SAMPLE_RATIO = Number(process.env.TESTGEN_ESTIMATE_PERF_RATIO || 0.08);

function applyEstimateBounds(estimated, targetCount) {
  const targets = Math.max(Number(targetCount) || 1, 1);
  return Math.max(targets, Math.min(Math.round(estimated), ESTIMATE_MAX_TOTAL));
}

function distributeEstimateEvenly(total, targetCount) {
  const n = Math.max(1, Math.round(Number(targetCount) || 1));
  const safeTotal = Math.max(n, Math.round(Number(total) || 0));
  const base = Math.floor(safeTotal / n);
  let remainder = safeTotal - base * n;
  return Array.from({ length: n }, () => {
    if (remainder > 0) {
      remainder -= 1;
      return base + 1;
    }
    return base;
  });
}

function endpointMethod(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return String(ep).trim().split(/\s+/)[0].toUpperCase();
  return String(ep.method || '').toUpperCase();
}

function countMutatingEndpoints(endpoints) {
  const list = Array.isArray(endpoints) ? endpoints : [];
  let n = 0;
  for (const ep of list) {
    const m = endpointMethod(ep);
    if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') n += 1;
  }
  return n;
}

function classifyTargetKind(target = {}) {
  const blob = [
    target.scheme_id,
    target.scheme_name,
    target.validation_id,
    target.validation_name,
    target.category_major_id,
    target.category_major_name,
    target.template_code,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/ts-09|load|perf|压测|性能|并发|吞吐|qps|stress|benchmark|latency|tps/.test(blob)) {
    return 'perf';
  }
  if (/异常|negative|error|fault|chaos|边界|bound|invalid|fail|拒|驳回|鉴权失败/.test(blob)) {
    return 'error_focus';
  }
  return 'functional';
}

function sampleErrorCount(endpointCount, endpoints) {
  const eps = Math.max(0, Math.round(Number(endpointCount) || 0));
  if (eps <= 0) return 0;
  const mutating = countMutatingEndpoints(endpoints);
  const pool = Math.max(mutating, Math.ceil(eps * 0.4));
  const raw = Math.ceil(pool * ERROR_SAMPLE_RATIO);
  return Math.min(eps, Math.max(Math.min(ERROR_SAMPLE_MIN, eps), raw));
}

function samplePerfCount(endpointCount) {
  const eps = Math.max(0, Math.round(Number(endpointCount) || 0));
  if (eps <= 0) return 0;
  return Math.max(1, Math.min(PERF_SAMPLE_MAX, Math.ceil(eps * PERF_SAMPLE_RATIO)));
}

function casesForTarget(endpointCount, endpoints, target) {
  const eps = Math.max(0, Math.round(Number(endpointCount) || 0));
  const kind = classifyTargetKind(target);
  if (eps <= 0) {
    return { count: 1, kind, detail: '无接口清单时保底 1 条' };
  }
  if (kind === 'perf') {
    const n = samplePerfCount(eps);
    return { count: n, kind, detail: `性能/并发：仅抽样 ${n} 个代表性接口（非全量）` };
  }
  if (kind === 'error_focus') {
    const n = Math.min(eps, Math.max(sampleErrorCount(eps, endpoints), Math.ceil(eps * 0.5)));
    return { count: n, kind, detail: `异常/边界焦点：约 ${n} 条（抽样，非每接口堆满）` };
  }
  const happy = eps;
  const error = sampleErrorCount(eps, endpoints);
  return {
    count: happy + error,
    kind,
    detail: `功能：正常 ${happy}（每接口 1 条）+ 异常抽样 ${error}`,
  };
}

function softCoverageFloor(endpointCount, endpoints, schemeTargets) {
  const eps = Math.max(0, Math.round(Number(endpointCount) || 0));
  const targets = Array.isArray(schemeTargets) && schemeTargets.length
    ? schemeTargets
    : [ { scheme_id: 'functional' } ];
  if (eps <= 0) return targets.length;

  let total = 0;
  for (const t of targets) {
    const kind = classifyTargetKind(t);
    if (kind === 'perf') total += samplePerfCount(eps);
    else if (kind === 'error_focus') total += Math.min(eps, Math.max(ERROR_SAMPLE_MIN, Math.ceil(eps * 0.3)));
    else total += eps;
  }
  return applyEstimateBounds(total, targets.length);
}

function scaleBreakdownToTotal(breakdownRaw, estimated) {
  const rawTotal = breakdownRaw.reduce((s, n) => s + n, 0);
  if (rawTotal <= 0) return distributeEstimateEvenly(estimated, breakdownRaw.length || 1);
  if (rawTotal === estimated) return breakdownRaw.slice();
  const scale = estimated / rawTotal;
  let breakdown = breakdownRaw.map(n => Math.max(1, Math.floor(n * scale)));
  let sum = breakdown.reduce((s, n) => s + n, 0);
  let i = 0;
  while (sum < estimated && i < breakdown.length * 4) {
    breakdown[i % breakdown.length] += 1;
    sum += 1;
    i += 1;
  }
  while (sum > estimated && breakdown.some(n => n > 1)) {
    const idx = breakdown.findIndex(n => n > 1);
    if (idx < 0) break;
    breakdown[idx] -= 1;
    sum -= 1;
  }
  return breakdown;
}

function tieredCoverageEstimate(endpointCount, endpoints, schemeTargets) {
  const eps = Math.max(0, Math.round(Number(endpointCount) || 0));
  const targets = Array.isArray(schemeTargets) && schemeTargets.length
    ? schemeTargets
    : [ { scheme_id: 'functional' } ];
  if (eps <= 0) return null;

  const perTargetMeta = targets.map(t => casesForTarget(eps, endpoints, t));
  const breakdownRaw = perTargetMeta.map(m => m.count);
  const rawTotal = breakdownRaw.reduce((s, n) => s + n, 0);
  const estimated = applyEstimateBounds(rawTotal, targets.length);
  const breakdown = scaleBreakdownToTotal(breakdownRaw, estimated);

  return {
    estimated_count: estimated,
    per_target: breakdown.length ? Math.round(estimated / breakdown.length) : estimated,
    target_breakdown: breakdown,
    soft_floor: softCoverageFloor(eps, endpoints, targets),
    per_target_meta: perTargetMeta,
    formula_hint: perTargetMeta.map((m, i) => `目标${i + 1}[${m.kind}] ${m.detail}`).join('；'),
  };
}

/** 兼容旧调用：无目标详情时按 functional × N */
function coverageEstimateFromEndpoints(endpointCount, targetCount, endpoints = [], schemeTargets) {
  const targets = Array.isArray(schemeTargets) && schemeTargets.length
    ? schemeTargets
    : Array.from({ length: Math.max(1, Math.round(Number(targetCount) || 1)) }, () => ({ scheme_id: 'functional' }));
  return tieredCoverageEstimate(endpointCount, endpoints, targets);
}

module.exports = {
  ESTIMATE_MAX_TOTAL,
  applyEstimateBounds,
  distributeEstimateEvenly,
  classifyTargetKind,
  casesForTarget,
  softCoverageFloor,
  tieredCoverageEstimate,
  coverageEstimateFromEndpoints,
  scaleBreakdownToTotal,
};
