'use strict';

const { collectPlaceholders } = require('../service/execution/runners/detPreflightRunner');
const { EXTRACT_RUNTIME_NOTE } = require('./extractRuntimeNote');

/**
 * DET poll / 动态 Path 启动前校验（DET-03）
 * @param {object} item
 * @param {object|null} runConfig
 */
function validateDetLaunchPreconditions(item, runConfig) {
  const configJson = runConfig?.config_json || {};
  if (item?.automation_command || configJson.execution_mode === 'cli') {
    return { ok: true, warnings: [] };
  }

  const path = configJson.endpoint_path || item?.endpoint_path || '';
  const placeholders = collectPlaceholders(path);
  const warnings = [];
  const needsTurn = placeholders.includes('turn_id');
  const needsSession = placeholders.includes('session_id');
  const preflightId = configJson.preflight_api_template_id || null;

  if ((needsTurn || needsSession) && !preflightId) {
    const err = new Error(
      `主请求 Path 含 ${needsTurn ? '{{turn_id}}' : '{{session_id}}'}，`
      + '请先关联前置接口模板（preflight_api_template_id），'
      + '否则执行期会 UNRESOLVED_PATH_PLACEHOLDER。'
      + ` ${EXTRACT_RUNTIME_NOTE}`,
    );
    err.status = 400;
    err.code = 'DET_PREFLIGHT_REQUIRED';
    throw err;
  }

  if (needsTurn && preflightId && configJson.preflight_include_main_request === false) {
    const err = new Error(
      'Path 需要 {{turn_id}}，但未勾选「执行模板主请求」（preflight_include_main_request）。'
      + 'poll 类用例须勾选以便模板 submit 导出 turn_id。'
      + ` ${EXTRACT_RUNTIME_NOTE}`,
    );
    err.status = 400;
    err.code = 'DET_POLL_MAIN_REQUEST_REQUIRED';
    throw err;
  }

  if (placeholders.length && !preflightId) {
    warnings.push(
      `Path 含占位符 ${placeholders.map(k => `{{${k}}}`).join(', ')}，`
      + '须由环境 fixed_params / 项目 manual 变量提供。'
      + ` ${EXTRACT_RUNTIME_NOTE}`,
    );
  }

  return { ok: true, warnings };
}

module.exports = {
  EXTRACT_RUNTIME_NOTE,
  validateDetLaunchPreconditions,
};
