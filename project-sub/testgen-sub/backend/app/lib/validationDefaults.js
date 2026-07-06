'use strict';

const { TEMPLATE_TABLES } = require('./configTemplateRegistry');

/**
 * 解析用例主验证 VS 默认值（大类 / 模板 / 前缀 / 方案主 VS）
 * @param {object} app egg app
 * @param {object} item test_item_detail row
 * @param {string} schemeId
 * @param {string} templateCode
 */
async function resolveDefaultValidationId(app, item, schemeId, templateCode) {
  if (templateCode) {
    const [ tplRows ] = await app.model.query(
      `SELECT default_validation_id FROM config_template_enum
       WHERE template_code = :code AND default_validation_id IS NOT NULL LIMIT 1`,
      { replacements: { code: templateCode } },
    );
    if (tplRows[0]?.default_validation_id) {
      return tplRows[0].default_validation_id;
    }
  }

  if (item?.category_major_id) {
    const [ majorRows ] = await app.model.query(
      `SELECT default_validation_id FROM test_category_major
       WHERE category_major_id = :majorId AND default_validation_id IS NOT NULL LIMIT 1`,
      { replacements: { majorId: item.category_major_id } },
    );
    if (majorRows[0]?.default_validation_id) {
      return majorRows[0].default_validation_id;
    }
  }

  if (item?.category_minor_id && schemeId) {
    const [ minorRows ] = await app.model.query(
      `SELECT validation_primary_id FROM test_category_minor_scheme
       WHERE category_minor_id = :minorId AND scheme_primary_id = :schemeId LIMIT 1`,
      { replacements: { minorId: item.category_minor_id, schemeId } },
    );
    if (minorRows[0]?.validation_primary_id) {
      return minorRows[0].validation_primary_id;
    }
  }

  if (item?.item_id) {
    const [ prefixRows ] = await app.model.query(
      `SELECT validation_primary_id FROM test_item_prefix_scheme
       WHERE :itemId LIKE item_prefix || '%'
       ORDER BY LENGTH(item_prefix) DESC LIMIT 1`,
      { replacements: { itemId: item.item_id } },
    );
    if (prefixRows[0]?.validation_primary_id) {
      return prefixRows[0].validation_primary_id;
    }
  }

  if (schemeId) {
    const [ pairRows ] = await app.model.query(
      `SELECT validation_id FROM test_scheme_validation_pair
       WHERE scheme_id = :schemeId AND is_primary = TRUE LIMIT 1`,
      { replacements: { schemeId } },
    );
    if (pairRows[0]?.validation_id) {
      return pairRows[0].validation_id;
    }
  }

  return item?.validation_primary_id || 'VS-04-CHAIN-OK';
}

/** @param {object} app @param {string} schemeId @param {string} validationId */
async function isValidationCompatibleWithScheme(app, schemeId, validationId) {
  if (!schemeId || !validationId) return false;
  const [ rows ] = await app.model.query(
    `SELECT 1 FROM test_scheme_validation_pair
     WHERE scheme_id = :schemeId AND validation_id = :validationId LIMIT 1`,
    { replacements: { schemeId, validationId } },
  );
  return rows.length > 0;
}

module.exports = {
  resolveDefaultValidationId,
  isValidationCompatibleWithScheme,
  TEMPLATE_TABLES,
};
