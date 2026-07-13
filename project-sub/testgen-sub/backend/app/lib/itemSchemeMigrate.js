'use strict';

const { QueryTypes } = require('sequelize');
const {
  MIXED_TS_MAJORS,
  SCHEME_TO_TEMPLATE,
  TEMPLATE_TABLES,
  CHAIN_SCHEME,
  API_CTX_TEMPLATE,
  API_CTX_SCHEME,
  normalizeStoredTemplateCode,
  getTemplateAlternativesForItem,
} = require('./configTemplateRegistry');
const { buildTemplateDefaults } = require('./generationTemplateHelper');
const {
  resolveDefaultValidationId,
  isValidationCompatibleWithScheme,
} = require('./validationDefaults');

/**
 * 手动改主 TS 时解析模板 code（优先用户指定，其次 scheme 映射）
 * @param {object} item
 * @param {string} schemeId
 * @param {string|null} [templateOverride]
 */
function resolveTemplateForSchemeChange(item, schemeId, templateOverride = null) {
  if (templateOverride) return templateOverride;
  if (MIXED_TS_MAJORS.has(item?.category_major_id) && schemeId === CHAIN_SCHEME) {
    return API_CTX_TEMPLATE;
  }
  return SCHEME_TO_TEMPLATE[schemeId] || 'TPL-DET';
}

/**
 * @param {import('egg').Application} app
 * @param {object} item test_item_detail row
 * @param {string} templateCode
 * @param {object} [defaults]
 */
async function upsertTemplateConfig(app, item, templateCode, defaults = null) {
  const table = TEMPLATE_TABLES[templateCode];
  if (!table) return false;

  const { config_json, threshold_json } = defaults || buildTemplateDefaults(templateCode, item);
  const [ existing ] = await app.model.query(
    `SELECT item_id FROM "${table}" WHERE item_id = :itemId LIMIT 1`,
    { replacements: { itemId: item.item_id }, type: QueryTypes.SELECT },
  );

  if (existing) {
    await app.model.query(
      `UPDATE "${table}" SET config_json = :configJson::jsonb, threshold_json = :thresholdJson::jsonb,
       config_source = 'scheme_migrate', updated_at = NOW() WHERE item_id = :itemId`,
      {
        replacements: {
          itemId: item.item_id,
          configJson: JSON.stringify(config_json),
          thresholdJson: JSON.stringify(threshold_json),
        },
      },
    );
  } else if (table === 'tpl_config_set') {
    await app.model.query(
      `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source, sample_set_id)
       VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, 'scheme_migrate', NULL)`,
      {
        replacements: {
          itemId: item.item_id,
          configJson: JSON.stringify(config_json),
          thresholdJson: JSON.stringify(threshold_json),
        },
      },
    );
  } else {
    await app.model.query(
      `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source)
       VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, 'scheme_migrate')`,
      {
        replacements: {
          itemId: item.item_id,
          configJson: JSON.stringify(config_json),
          thresholdJson: JSON.stringify(threshold_json),
        },
      },
    );
  }
  return true;
}

/**
 * 主 TS 变更：更新用例元数据、模板配置与 ft_run_config
 * @param {import('egg').Context} ctx
 * @param {object} item 当前用例
 * @param {object} opts
 */
async function migrateItemPrimaryScheme(ctx, item, opts = {}) {
  const {
    scheme_primary_id: newSchemeId,
    validation_primary_id: validationOverride,
    template_code: templateOverride,
    migrate_config: migrateConfig = true,
  } = opts;

  const oldSchemeId = item.scheme_primary_id;
  const oldTemplateCode = require('./configTemplateRegistry').resolveTemplateCodeFromItem(item);
  const schemeChanged = Boolean(newSchemeId && newSchemeId !== oldSchemeId);

  const schemeId = newSchemeId || oldSchemeId;
  if (!schemeId) {
    const err = new Error('主方案不能为空');
    err.status = 400;
    throw err;
  }

  const [ schemeRows ] = await ctx.app.model.query(
    'SELECT scheme_id FROM test_scheme_enum WHERE scheme_id = :id LIMIT 1',
    { replacements: { id: schemeId }, type: QueryTypes.SELECT },
  );
  if (!schemeRows.length) {
    const err = new Error(`主方案不存在: ${schemeId}`);
    err.status = 400;
    throw err;
  }

  const effectiveTemplate = resolveTemplateForSchemeChange(item, schemeId, templateOverride || null);
  const storedTemplateCode = normalizeStoredTemplateCode(effectiveTemplate, schemeId);

  let validationId = validationOverride || item.validation_primary_id;
  const validationStillOk = await isValidationCompatibleWithScheme(ctx.app, schemeId, validationId);
  if (!validationStillOk) {
    validationId = await resolveDefaultValidationId(
      ctx.app,
      item,
      schemeId,
      effectiveTemplate,
    );
  }
  if (!validationId) {
    const err = new Error('无法解析与主方案匹配的主验证');
    err.status = 400;
    throw err;
  }
  const compatible = await isValidationCompatibleWithScheme(ctx.app, schemeId, validationId);
  if (!compatible) {
    const err = new Error('主验证与主方案不匹配');
    err.status = 400;
    throw err;
  }

  let schemeSecondaryId = item.scheme_secondary_id;
  let validationSecondaryId = item.validation_secondary_id;
  if (schemeSecondaryId === schemeId) {
    schemeSecondaryId = null;
    validationSecondaryId = null;
  }

  await ctx.app.model.query(
    `UPDATE test_item_detail SET
       scheme_primary_id = :schemeId,
       validation_primary_id = :validationId,
       template_code = :templateCode,
       scheme_secondary_id = :schemeSecondaryId,
       validation_secondary_id = :validationSecondaryId,
       updated_at = NOW()
     WHERE item_id = :itemId`,
    {
      replacements: {
        itemId: item.item_id,
        schemeId,
        validationId,
        templateCode: storedTemplateCode,
        schemeSecondaryId,
        validationSecondaryId,
      },
    },
  );

  const updatedItem = {
    ...item,
    scheme_primary_id: schemeId,
    validation_primary_id: validationId,
    template_code: storedTemplateCode,
    scheme_secondary_id: schemeSecondaryId,
    validation_secondary_id: validationSecondaryId,
  };

  let configInitialized = false;
  if (migrateConfig && (schemeChanged || effectiveTemplate !== oldTemplateCode)) {
    configInitialized = await upsertTemplateConfig(ctx.app, updatedItem, effectiveTemplate);
    const { config_json, threshold_json } = buildTemplateDefaults(effectiveTemplate, updatedItem);
    const tplConfig = config_json || {};
    await ctx.service.fitnessExecution.saveRunConfig(item.item_id, {
      scheme_id: schemeId,
      config_json: {
        ...tplConfig,
        execution_mode: effectiveTemplate === API_CTX_TEMPLATE ? 'api_ctx' : tplConfig.execution_mode,
        use_agent_judge: effectiveTemplate === API_CTX_TEMPLATE ? true : tplConfig.use_agent_judge,
      },
      threshold_json: threshold_json || {},
      api_template_id: tplConfig.preflight_api_template_id
        ?? tplConfig.api_template_id
        ?? null,
      use_api_template: Boolean(
        tplConfig.preflight_api_template_id
        || tplConfig.use_api_template
        || effectiveTemplate === API_CTX_TEMPLATE,
      ),
      inject_bindings: tplConfig.inject_bindings || {},
    });
  }

  const templateAlternatives = getTemplateAlternativesForItem({
    ...updatedItem,
    scheme_primary_id: schemeId,
  });

  return {
    scheme_changed: schemeChanged,
    old_scheme_id: oldSchemeId,
    new_scheme_id: schemeId,
    old_template_code: oldTemplateCode,
    template_code: effectiveTemplate,
    validation_primary_id: validationId,
    validation_auto_adjusted: validationOverride
      ? validationOverride !== item.validation_primary_id
      : item.validation_primary_id !== validationId,
    config_initialized: configInitialized,
    template_alternatives: templateAlternatives,
    hint: configInitialized
      ? '已按新 TS 初始化配置模板默认值，请到「配置」页核对并手动调整。'
      : 'TS 已更新；未重置配置，请到「配置」页确认是否需手动调整。',
  };
}

module.exports = {
  resolveTemplateForSchemeChange,
  upsertTemplateConfig,
  migrateItemPrimaryScheme,
};
