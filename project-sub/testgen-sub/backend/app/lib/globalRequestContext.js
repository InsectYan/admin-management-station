'use strict';

const { requireProjectCode } = require('./envProjectScope');
const { EXTRACT_RUNTIME_NOTE } = require('./extractRuntimeNote');

/**
 * 合并执行环境 auth_configured、项目默认请求头、项目全局变量，供 HTTP 请求注入。
 * auth_configured 形状：
 * {
 *   global_headers: { Authorization: 'Bearer ...', 'X-Internal-Service-Key': '...' },
 *   fixed_params: { token: '...', session_id: '...', turn_id: '...' }
 * }
 *
 * 请求头最终合并（用例 headers 由调用方 mergeRequestHeaders 叠加，权重最高）：
 *   { ...env.global_headers, ...project_request_header }
 *
 * @param {import('egg').Context} ctx
 * @param {{ project_code: string, execution_env?: object }} opts
 */
async function loadGlobalRequestContext(ctx, opts = {}) {
  const projectCode = requireProjectCode(opts.project_code);
  const headers = {};
  const vars = {};
  const skipped_extract_keys = [];

  const env = opts.execution_env || null;
  const auth = env?.auth_configured || {};
  if (auth.global_headers && typeof auth.global_headers === 'object') {
    Object.assign(headers, auth.global_headers);
  }
  if (auth.fixed_params && typeof auth.fixed_params === 'object') {
    Object.assign(vars, auth.fixed_params);
  }
  if (auth.headers && typeof auth.headers === 'object') {
    Object.assign(headers, auth.headers);
  }

  try {
    const headerRows = await ctx.model.ProjectRequestHeader.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    for (const row of headerRows) {
      const key = String(row.header_key || '').trim();
      if (!key) continue;
      headers[key] = row.header_value == null ? '' : String(row.header_value);
    }
  } catch {
    // project_request_header 表可能未初始化
  }

  try {
    const rows = await ctx.model.ProjectEnvVariable.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    for (const row of rows) {
      if (row.source === 'manual' && row.var_value) {
        vars[row.var_key] = row.var_value;
      } else if (row.source === 'extract') {
        skipped_extract_keys.push(row.var_key);
      }
    }
  } catch {
    // project_env_variable 表可能未初始化
  }

  return {
    headers,
    vars,
    project_code: projectCode,
    skipped_extract_keys,
    extract_runtime_note: skipped_extract_keys.length ? EXTRACT_RUNTIME_NOTE : null,
  };
}

/**
 * 合并请求头：全局（环境 + 项目）在前，用例配置在后覆盖。
 * @param {Record<string, string>} globalHeaders
 * @param {Record<string, unknown>} requestHeaders
 */
function mergeRequestHeaders(globalHeaders = {}, requestHeaders = {}) {
  return { ...globalHeaders, ...requestHeaders };
}

module.exports = {
  loadGlobalRequestContext,
  mergeRequestHeaders,
};
