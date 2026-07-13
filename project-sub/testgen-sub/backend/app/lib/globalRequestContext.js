'use strict';

/**
 * 合并执行环境 auth_configured、项目全局变量，供 HTTP 请求注入。
 * auth_configured 形状：
 * {
 *   global_headers: { Authorization: 'Bearer ...', 'X-Internal-Service-Key': '...' },
 *   fixed_params: { token: '...', session_id: '...', turn_id: '...' }
 * }
 * @param {import('egg').Context} ctx
 * @param {{ project_code?: string }} [opts]
 */
async function loadGlobalRequestContext(ctx, opts = {}) {
  const projectCode = opts.project_code || 'fitness-agent';
  const headers = {};
  const vars = {};

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
    const rows = await ctx.model.ProjectEnvVariable.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    for (const row of rows) {
      if (row.source === 'manual' && row.var_value) {
        vars[row.var_key] = row.var_value;
      }
    }
  } catch {
    // project_env_variable 表可能未初始化
  }

  return { headers, vars };
}

/**
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
