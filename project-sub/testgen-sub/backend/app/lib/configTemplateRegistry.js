'use strict';

/** 混合 TS 大类：不挂载大类模板，按 scheme_primary_id 解析 */
const MIXED_TS_MAJORS = new Set([ 'C1', 'C2', 'C3', 'C4' ]);

const SCHEME_TO_TEMPLATE = {
  'TS-01-DET': 'TPL-DET',
  'TS-02-BND': 'TPL-BND',
  'TS-03-REP': 'TPL-REP',
  'TS-04-SET': 'TPL-SET',
  'TS-05-CHAIN': 'TPL-CHAIN',
  'TS-06-PAIR': 'TPL-PAIR',
  'TS-07-NEG': 'TPL-NEG',
  'TS-08-OBS': 'TPL-OBS',
  'TS-09-LOAD': 'TPL-LOAD',
  'TS-10-MAN': 'TPL-MAN',
};

const TEMPLATE_TABLES = {
  'TPL-DET': 'tpl_config_det',
  'TPL-BND': 'tpl_config_bnd',
  'TPL-REP': 'tpl_config_rep',
  'TPL-SET': 'tpl_config_set',
  'TPL-CHAIN': 'tpl_config_chain',
  'TPL-PAIR': 'tpl_config_pair',
  'TPL-NEG': 'tpl_config_neg',
  'TPL-OBS': 'tpl_config_obs',
  'TPL-LOAD': 'tpl_config_load',
  'TPL-MAN': 'tpl_config_man',
};

const TEMPLATE_NAMES = {
  'TPL-DET': '确定性单次',
  'TPL-BND': '边界矩阵',
  'TPL-REP': '重复抽样',
  'TPL-SET': '固定样本集',
  'TPL-CHAIN': '多步链路',
  'TPL-PAIR': '对照对比',
  'TPL-NEG': '对抗专项',
  'TPL-OBS': '可观测稽核',
  'TPL-LOAD': '压测容量',
  'TPL-MAN': '人工评审',
};

const ALLOWED_TABLE_NAMES = new Set(Object.values(TEMPLATE_TABLES));

function assertTemplateTable(tableName) {
  if (!ALLOWED_TABLE_NAMES.has(tableName)) {
    const err = new Error(`非法模板表: ${tableName}`);
    err.status = 400;
    throw err;
  }
}

/**
 * 从用例行解析模板 code（大类挂载优先，混合 TS 走 scheme）
 * @param {{ category_major_id?: string, scheme_primary_id?: string, template_code?: string, mapped_template_code?: string }} item
 */
function resolveTemplateCodeFromItem(item) {
  if (!item) return 'TPL-DET';
  if (MIXED_TS_MAJORS.has(item.category_major_id)) {
    return item.scheme_template_code
      || SCHEME_TO_TEMPLATE[item.scheme_primary_id]
      || item.template_code
      || 'TPL-DET';
  }
  return item.mapped_template_code
    || item.category_major_template_code
    || item.template_code
    || SCHEME_TO_TEMPLATE[item.scheme_primary_id]
    || 'TPL-DET';
}

/**
 * 列表/详情 enrich 后统一写入 template_code / template_name
 */
function applyResolvedTemplate(row) {
  if (!row) return row;
  const template_code = resolveTemplateCodeFromItem(row);
  let template_name = row.template_name;
  if (MIXED_TS_MAJORS.has(row.category_major_id)) {
    template_name = row.scheme_template_name || template_name;
  } else {
    template_name = row.mapped_template_name || template_name;
  }
  if (!template_name) {
    template_name = TEMPLATE_NAMES[template_code] || template_name;
  }
  return { ...row, template_code, template_name };
}

module.exports = {
  MIXED_TS_MAJORS,
  SCHEME_TO_TEMPLATE,
  TEMPLATE_TABLES,
  TEMPLATE_NAMES,
  ALLOWED_TABLE_NAMES,
  assertTemplateTable,
  resolveTemplateCodeFromItem,
  applyResolvedTemplate,
};
