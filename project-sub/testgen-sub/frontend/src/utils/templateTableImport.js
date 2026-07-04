/**
 * 从 JSON 文本解析模板表格行数组。
 * 支持：直接数组、[arrayKey] 对象、或含 config_json 的完整配置。
 */
export function parseTemplateTableJson(text, arrayKey) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim());
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '格式无效'}`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object') {
    const configJson = parsed.config_json;
    if (configJson && typeof configJson === 'object' && Array.isArray(configJson[arrayKey])) {
      return configJson[arrayKey];
    }
    if (Array.isArray(parsed[arrayKey])) {
      return parsed[arrayKey];
    }
  }

  throw new Error(
    `未找到有效的 ${arrayKey} 数组，请上传 JSON 数组或 { "${arrayKey}": [...] } 格式`,
  );
}

/** @param {string} text @param {string} arrayKey */
export function parseTemplateConfigRoot(text, arrayKey) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim());
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '格式无效'}`);
  }

  if (Array.isArray(parsed)) {
    return { rows: parsed, vars: {} };
  }

  if (parsed && typeof parsed === 'object') {
    const configJson = parsed.config_json;
    const vars = parsed.vars
      || (configJson && typeof configJson === 'object' ? configJson.vars : null)
      || {};
    if (configJson && typeof configJson === 'object' && Array.isArray(configJson[arrayKey])) {
      return { rows: configJson[arrayKey], vars };
    }
    if (Array.isArray(parsed[arrayKey])) {
      return { rows: parsed[arrayKey], vars };
    }
  }

  throw new Error(
    `未找到有效的 ${arrayKey} 数组，请上传 JSON 数组或 { "${arrayKey}": [...] } 格式`,
  );
}
