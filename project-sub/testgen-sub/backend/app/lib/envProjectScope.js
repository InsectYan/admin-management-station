'use strict';

/**
 * 执行环境项目隔离纯函数（可单测 / 离线 smoke）
 */

function requireProjectCode(projectCode, label = 'project_code') {
  const code = projectCode == null ? '' : String(projectCode).trim();
  if (!code) {
    const err = new Error(`${label} 必填：执行环境必须绑定项目，禁止回落到 fitness-agent`);
    err.status = 400;
    err.code = 'PROJECT_CODE_REQUIRED';
    throw err;
  }
  return code;
}

/**
 * @param {object|null} envRow
 * @param {string} projectCode
 */
function assertEnvBelongsToProject(envRow, projectCode) {
  const code = requireProjectCode(projectCode);
  if (!envRow) {
    const err = new Error(
      `项目「${code}」未配置执行环境，请先在本项目下新增环境（勿使用其它项目的环境）`,
    );
    err.status = 400;
    err.code = 'ENV_NOT_CONFIGURED';
    throw err;
  }
  const envProject = envRow.project_code == null ? '' : String(envRow.project_code).trim();
  if (envProject !== code) {
    const err = new Error(
      `执行环境 #${envRow.id}（${envRow.name || ''}）属于项目「${envProject || '(空)'}」，`
      + `与用例项目「${code}」不匹配`,
    );
    err.status = 400;
    err.code = 'ENV_PROJECT_MISMATCH';
    throw err;
  }
  return envRow;
}

/**
 * 从候选列表中按项目挑选默认环境（禁止跨项目）
 * @param {Array<{id:number,project_code?:string,is_default?:boolean}>} rows
 * @param {string} projectCode
 */
function pickDefaultEnvForProject(rows, projectCode) {
  const code = requireProjectCode(projectCode);
  const scoped = (rows || []).filter(r => String(r.project_code || '').trim() === code);
  if (!scoped.length) return null;
  return scoped.find(r => r.is_default) || scoped[0];
}

module.exports = {
  requireProjectCode,
  assertEnvBelongsToProject,
  pickDefaultEnvForProject,
};
