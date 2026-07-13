'use strict';

/**
 * Agent 未返回 agent_explanation 时，根据用例与生成配置构建说明卡片数据
 * @param {object} item
 * @param {string} templateCode
 * @param {object} configJson
 */
function buildDetAgentExplanation(item = {}, configJson = {}) {
  const reasons = [];
  const missing = [];

  if (item.automation_command) {
    reasons.push({
      field: 'execution_mode',
      reason: '用例含 automation_command，将走 CLI 执行，无需 HTTP 主请求配置',
      editable: false,
    });
  } else {
    if (configJson.endpoint_path || item.endpoint_path) {
      reasons.push({
        field: 'endpoint_path',
        reason: `根据用例 test_steps / endpoint_path 推断主请求路径：${configJson.endpoint_path || item.endpoint_path}`,
        editable: true,
      });
    }
    if (configJson.http_method || item.http_method) {
      reasons.push({
        field: 'http_method',
        reason: `HTTP 方法取自用例元数据：${configJson.http_method || item.http_method}`,
        editable: true,
      });
    }
    if (configJson.http_status_expected != null) {
      reasons.push({
        field: 'http_status_expected',
        reason: `期望状态码 ${configJson.http_status_expected}；submit 类接口注意 202/200 幂等差异`,
        editable: true,
      });
    }
    if (configJson.body || configJson.test_input_example) {
      reasons.push({
        field: 'body',
        reason: '请求体由 test_input_example 或断言点推断；含动态字段时可改为 {{session_id}} 等插值',
        editable: true,
      });
    }
    if (configJson.headers && Object.keys(configJson.headers).length) {
      reasons.push({
        field: 'headers',
        reason: '请求头可由环境全局配置继承，此处为用例级补充',
        editable: true,
      });
    }
    if (configJson.preflight_api_template_id) {
      reasons.push({
        field: 'preflight_api_template_id',
        reason: `关联前置接口模板 #${configJson.preflight_api_template_id}，执行前先跑 preflight 获取入参`,
        editable: true,
      });
    } else if (/session|turn|token|auth/i.test(JSON.stringify(item))) {
      missing.push('可能需要关联前置接口模板以获取 session_id / turn_id / token，请在「前置接口模板」中选择');
    }
  }

  if (!item.endpoint_path && !item.automation_command && !configJson.endpoint_path) {
    missing.push('用例缺少 endpoint_path，请手动填写主请求 Path');
  }

  return {
    summary: item.automation_command
      ? '已识别为 CLI 用例，配置以命令行为主。'
      : '已根据用例元数据生成 HTTP 主请求配置；前置变量可通过关联接口模板或环境固定参数补充。',
    reasons,
    missing_prerequisites: missing,
    adjustable_hint: '带「可手动调整」标记的字段可在保存前修改；Path/Body/Headers 支持 {{key}} 引用环境固定参数或前置 extract 变量。',
  };
}

/**
 * @param {object} item
 * @param {string} templateCode
 * @param {object} configJson
 * @param {object} [agentOutput]
 */
function buildAgentExplanation(item, templateCode, configJson, agentOutput = {}) {
  if (agentOutput.agent_explanation && typeof agentOutput.agent_explanation === 'object') {
    return agentOutput.agent_explanation;
  }
  if (agentOutput.explanation && typeof agentOutput.explanation === 'object') {
    return agentOutput.explanation;
  }
  if (templateCode === 'TPL-DET') {
    return buildDetAgentExplanation(item, configJson);
  }
  return agentOutput.note
    ? { summary: String(agentOutput.note), reasons: [], missing_prerequisites: [] }
    : null;
}

module.exports = {
  buildDetAgentExplanation,
  buildAgentExplanation,
};
