'use strict';

const { extractResponseText } = require('./apiCtxContent');

const DEFAULT_SEMANTIC_THRESHOLD = 0.75;
const RESPONSE_EXCERPT_LEN = 120;

/** @param {object} [thresholdJson] */
function resolveSemanticThreshold(thresholdJson = {}) {
  const raw = thresholdJson.semantic_threshold
    ?? thresholdJson.semantic_pass_threshold
    ?? thresholdJson.pass_threshold;
  if (raw == null || raw === '') return DEFAULT_SEMANTIC_THRESHOLD;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SEMANTIC_THRESHOLD;
  return n > 1 ? n / 100 : n;
}

/** @param {unknown} score */
function normalizeSemanticScore(score) {
  if (score == null || score === '') return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n > 1) return Math.min(n, 100) / 100;
  if (n < 0) return 0;
  return n;
}

/** @param {unknown} score 0~1 */
function formatConfidencePercent(score) {
  const n = normalizeSemanticScore(score);
  if (n == null) return null;
  return Math.round(n * 1000) / 10;
}

/** @param {string} text @param {number} [max] */
function excerptText(text, max = RESPONSE_EXCERPT_LEN) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/**
 * @param {object} match observation-match 输出
 * @param {number} threshold 0~1
 */
function resolveSemanticPass(match, threshold) {
  if (match?.pass === true) return true;
  if (match?.pass === false) return false;
  const score = normalizeSemanticScore(match?.score);
  if (score == null) return false;
  return score >= threshold;
}

/**
 * 从 submit 请求体 / 注入值解析样本 message 文案
 * @param {object} sub
 * @param {Record<string, unknown>} [injectValues]
 */
function resolveInjectMessage(sub, injectValues = {}) {
  const fromArtifact = sub.artifacts?.inject_message;
  if (fromArtifact && String(fromArtifact).trim()) return String(fromArtifact).trim();

  const fromInject = injectValues.message ?? injectValues.text;
  if (fromInject != null && String(fromInject).trim()) return String(fromInject).trim();

  const submitBody = sub.artifacts?.submit?.http?.body;
  if (submitBody && typeof submitBody === 'object' && submitBody.message) {
    return String(submitBody.message).trim();
  }

  const reqBody = sub.artifacts?.submit?.http?.requestBody;
  if (reqBody && typeof reqBody === 'object' && reqBody.message) {
    return String(reqBody.message).trim();
  }

  return '';
}

/**
 * @param {object} sub
 * @param {string[]} [extractPaths]
 */
function resolveAgentResponseText(sub, extractPaths) {
  const cached = sub.artifacts?.response_text;
  if (cached && String(cached).trim()) return String(cached).trim();

  const body = sub.artifacts?.http?.body ?? sub.artifacts?.poll?.http?.body;
  return extractResponseText(body, extractPaths);
}

/**
 * 写入 TPL-API-CTX 语义展示字段（供 ft_run_result 与前端主方案子项表）
 * @param {import('../service/execution/runOrchestrator').SubRunResult} sub
 * @param {object} options
 */
function applyApiCtxSemanticPresentation(sub, options = {}) {
  const {
    expected = '',
    match = null,
    threshold = DEFAULT_SEMANTIC_THRESHOLD,
    functionalOk = true,
    skipped = false,
    skipReason = '',
    error = null,
  } = options;

  const message = resolveInjectMessage(sub, options.injectValues);
  const responseFull = resolveAgentResponseText(sub, options.extractPaths);
  const responseExcerpt = excerptText(responseFull);

  if (message) {
    sub.input_summary = message;
  }

  /** @type {object} */
  const semantic = {
    input_message: message || null,
    response_excerpt: responseExcerpt || null,
    response_full: responseFull || null,
    expected_observation: expected || null,
    threshold,
    threshold_percent: formatConfidencePercent(threshold),
  };

  if (!functionalOk || skipped) {
    sub.output_summary = skipped
      ? (skipReason || '内容验证已跳过')
      : (responseExcerpt || '功能性未通过（无 Agent 回复）');
    semantic.status = skipped ? 'skipped' : 'functional_fail';
    semantic.confidence = null;
    semantic.confidence_percent = null;
    semantic.pass = false;
    if (skipped) sub.sub_verdict = sub.sub_verdict || 'fail';
  } else if (error) {
    sub.output_summary = responseExcerpt || '语义比对异常';
    semantic.status = 'error';
    semantic.error = error;
    semantic.confidence = null;
    semantic.confidence_percent = null;
    semantic.pass = false;
    sub.sub_verdict = 'fail';
  } else if (match) {
    const score = normalizeSemanticScore(match.score);
    const pass = resolveSemanticPass(match, threshold);
    semantic.status = 'judged';
    semantic.confidence = score;
    semantic.confidence_percent = formatConfidencePercent(score);
    semantic.pass = pass;
    semantic.fallback = match.fallback === true;
    semantic.reasons = match.reasons || [];
    sub.semantic_score = score;
    sub.semantic_pass = pass;
    sub.sub_verdict = pass ? 'pass' : 'fail';
    sub.output_summary = responseExcerpt || excerptText(match.actual_excerpt, RESPONSE_EXCERPT_LEN);
  } else {
    sub.output_summary = responseExcerpt || sub.output_summary;
    semantic.status = 'pending';
  }

  sub.semantic = semantic;
  sub.artifacts = {
    ...(sub.artifacts || {}),
    inject_message: message || sub.artifacts?.inject_message,
    response_text: responseFull,
    response_excerpt: responseExcerpt,
    semantic,
  };

  return sub;
}

module.exports = {
  DEFAULT_SEMANTIC_THRESHOLD,
  RESPONSE_EXCERPT_LEN,
  resolveSemanticThreshold,
  normalizeSemanticScore,
  formatConfidencePercent,
  excerptText,
  resolveSemanticPass,
  resolveInjectMessage,
  resolveAgentResponseText,
  applyApiCtxSemanticPresentation,
};
