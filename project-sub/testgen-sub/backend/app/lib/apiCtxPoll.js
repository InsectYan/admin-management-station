'use strict';

const { getByPath } = require('../service/execution/runners/varPool');

/**
 * 平台内置 poll 终态别名组 — 不同 Agent/BFF 可复用或显式引用 until_alias_group
 * @type {Record<string, string[]>}
 */
const POLL_ALIAS_GROUPS = {
  /** 异步任务成功终态（fitness-agent completed、通用 done/success 等） */
  async_job_success: [ 'completed', 'done', 'success', 'finished', 'succeeded' ],
  /** 异步任务进行中（仅用于文档/扩展，until 判定默认不匹配这些值） */
  async_job_pending: [ 'pending', 'processing', 'running', 'in_progress', 'queued', 'active' ],
  /** 异步任务失败终态 */
  async_job_fail: [ 'failed', 'cancelled', 'canceled', 'error', 'timeout', 'aborted', 'rejected' ],
};

/** @param {unknown} value */
function normToken(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** @param {unknown} value @param {Set<string>} set */
function addToken(value, set) {
  const t = normToken(value);
  if (t) set.add(t);
}

/** @param {string[]|undefined} list @param {Set<string>} set */
function addList(list, set) {
  if (!Array.isArray(list)) return;
  for (const item of list) addToken(item, set);
}

/** @param {string|undefined} groupName @param {Set<string>} set */
function addAliasGroup(groupName, set) {
  if (!groupName) return;
  addList(POLL_ALIAS_GROUPS[groupName], set);
}

/**
 * 解析 poll until 可接受值集合
 * @param {object} pollCfg
 * @returns {{ path?: string, matchers: string[], strict: boolean, describe: string }}
 */
function resolvePollUntilMatchers(pollCfg = {}) {
  const path = pollCfg.until_json_path;
  const strict = pollCfg.strict_until === true;
  const matchers = new Set();

  if (Array.isArray(pollCfg.until_values) && pollCfg.until_values.length) {
    addList(pollCfg.until_values, matchers);
  }
  if (pollCfg.until_value != null && pollCfg.until_value !== '') {
    addToken(pollCfg.until_value, matchers);
  }
  addAliasGroup(pollCfg.until_alias_group, matchers);

  const isStatusPath = !path || path === '$.status' || /\.status$/i.test(String(path));

  if (!strict && isStatusPath && !pollCfg.until_alias_group
    && !(Array.isArray(pollCfg.until_values) && pollCfg.until_values.length)) {
    addAliasGroup('async_job_success', matchers);
  }

  if (matchers.size === 0) {
    addAliasGroup('async_job_success', matchers);
  }

  const matcherList = [ ...matchers ];
  const describe = matcherList.length <= 4
    ? matcherList.join('|')
    : `${matcherList.slice(0, 3).join('|')}|…(+${matcherList.length - 3})`;

  return { path, matchers: matcherList, strict, describe };
}

/**
 * @param {object} pollCfg
 * @returns {string[]}
 */
function resolveTerminalFailStatuses(pollCfg = {}) {
  const fails = new Set();
  addList(pollCfg.terminal_fail_statuses, fails);
  if (pollCfg.terminal_fail_alias_group) {
    addAliasGroup(pollCfg.terminal_fail_alias_group, fails);
  } else if (!pollCfg.terminal_fail_statuses?.length) {
    addAliasGroup('async_job_fail', fails);
  }
  return [ ...fails ];
}

/**
 * @param {unknown} body
 * @param {object} pollCfg
 */
function pollStatusMatchesUntil(body, pollCfg) {
  const { path, matchers } = resolvePollUntilMatchers(pollCfg);
  if (!path) return true;
  const actual = normToken(getByPath(body, path));
  if (!actual) return false;
  return matchers.includes(actual);
}

/**
 * 规范化模板/用例 poll 配置（不丢字段，仅补默认别名组）
 * @param {object|null|undefined} poll
 */
function normalizePollConfig(poll) {
  if (!poll || typeof poll !== 'object') return poll;
  const normalized = { ...poll };

  const path = String(normalized.until_json_path || '$.status');
  const isTurnPoll = /\/turns\/\{\{turn_id\}\}/i.test(String(normalized.path || ''))
    || /\/turns\/submit/i.test(String(normalized.path || ''));

  if (isTurnPoll && !normalized.until_alias_group && !normalized.until_values?.length
    && normalized.strict_until !== true) {
    normalized.until_json_path = path;
    normalized.until_alias_group = normalized.until_alias_group || 'async_job_success';
  }

  return normalized;
}

/** @deprecated 保留兼容 */
function normalizePollUntilValue(value) {
  return normToken(value) || 'completed';
}

module.exports = {
  POLL_ALIAS_GROUPS,
  normalizePollUntilValue,
  resolvePollUntilMatchers,
  resolveTerminalFailStatuses,
  pollStatusMatchesUntil,
  normalizePollConfig,
};
