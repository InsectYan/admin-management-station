'use strict';

/** 执行配置字段中文名（Gate / 异常信封 / Launch 展示） */
const CONFIG_FIELD_LABELS = {
  endpoint_path: '请求路径 Path',
  http_method: 'HTTP 方法',
  http_status_expected: '期望状态码',
  body: '请求 Body',
  headers: '请求头',
  'headers.Authorization': '鉴权头 Authorization',
  Authorization: '鉴权头 Authorization',
  preflight_api_template_id: '前置接口模板',
  preflight_include_main_request: '执行模板主请求',
  'env.bff_coach_url': '执行环境 BFF 地址',
  autofill_pipeline: '自动补齐管线',
};

/**
 * @param {string} field
 * @returns {string}
 */
function configFieldLabel(field) {
  if (!field) return '';
  const key = String(field);
  if (CONFIG_FIELD_LABELS[key]) return CONFIG_FIELD_LABELS[key];
  if (key.startsWith('path.{{')) {
    return `路径变量 ${key.slice(5)}`;
  }
  if (key.startsWith('path.:')) {
    return `路径参数 ${key.slice(5)}`;
  }
  if (key.startsWith('body.')) {
    return `Body 字段 ${key.slice(5)}`;
  }
  if (key.startsWith('headers.')) {
    return `请求头 ${key.slice(8)}`;
  }
  return key;
}

/**
 * @param {{ field?: string, detail?: string, hint?: string, reason?: string }} item
 * @returns {string}
 */
function formatMissingFieldLine(item) {
  const field = item.field || '';
  const label = configFieldLabel(field);
  const detail = item.detail || item.hint || item.reason || '';
  const head = label && label !== field ? `${label}（${field}）` : (label || field);
  return detail ? `${head}：${detail}` : head;
}

module.exports = {
  CONFIG_FIELD_LABELS,
  configFieldLabel,
  formatMissingFieldLine,
};
