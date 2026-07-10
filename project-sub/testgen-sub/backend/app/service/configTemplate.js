'use strict';

const { QueryTypes } = require('sequelize');
const {
  MIXED_TS_MAJORS,
  SCHEME_TO_TEMPLATE,
  SCHEME_TEMPLATE_ALTERNATIVES,
  TEMPLATE_TABLES,
  API_CTX_TEMPLATE,
  API_CTX_SCHEME,
  CHAIN_SCHEME,
  assertTemplateTable,
  resolveTemplateCodeFromItem,
  resolveSchemeForTemplate,
  normalizeStoredTemplateCode,
  buildItemTemplateSwitchMeta,
} = require('../lib/configTemplateRegistry');
const { normalizeDetConfigJson } = require('../lib/httpRequestBody');
const {
  resolveDefaultValidationId,
  isValidationCompatibleWithScheme,
} = require('../lib/validationDefaults');

class ConfigTemplateService extends require('egg').Service {
  async listTemplates() {
    const rows = await this.app.model.query(
      `SELECT t.*, s.name AS scheme_name
       FROM config_template_enum t
       LEFT JOIN test_scheme_enum s ON s.scheme_id = t.scheme_id
       ORDER BY t.sort_order ASC`,
      { type: QueryTypes.SELECT },
    );
    return rows;
  }

  async listMajorsOverview() {
    const rows = await this.app.model.query(
      `SELECT m.category_major_id, m.name AS major_name, m.dimension_id,
              d.name AS dimension_name, m.description AS major_description,
              m.default_scheme_id, m.default_validation_id,
              mt.template_code, mt.note AS template_note,
              t.name AS template_name, COALESCE(t.scheme_id, m.default_scheme_id) AS scheme_id,
              t.function_desc, t.scenario_desc,
              ts.name AS scheme_name,
              v.name AS validation_name,
              CASE WHEN m.category_major_id IN ('C1','C2','C3','C4') THEN TRUE ELSE FALSE END AS is_mixed
       FROM test_category_major m
       LEFT JOIN test_dimension d ON d.dimension_id = m.dimension_id
       LEFT JOIN test_category_major_template mt ON mt.category_major_id = m.category_major_id
       LEFT JOIN config_template_enum t ON t.template_code = mt.template_code
       LEFT JOIN test_scheme_enum ts ON ts.scheme_id = COALESCE(t.scheme_id, m.default_scheme_id)
       LEFT JOIN test_validation_enum v ON v.validation_id = m.default_validation_id
       ORDER BY m.dimension_id, m.category_major_id`,
      { type: QueryTypes.SELECT },
    );
    return rows;
  }

  async listTemplatesOverview() {
    const templates = await this.listTemplates();
    const majorLinks = await this.app.model.query(
      `SELECT mt.template_code, mt.category_major_id, m.name AS major_name,
              m.default_validation_id, v.name AS validation_name
       FROM test_category_major_template mt
       JOIN test_category_major m ON m.category_major_id = mt.category_major_id
       LEFT JOIN test_validation_enum v ON v.validation_id = m.default_validation_id
       ORDER BY mt.template_code, mt.category_major_id`,
      { type: QueryTypes.SELECT },
    );
    const byTemplate = {};
    for (const row of majorLinks) {
      if (!byTemplate[row.template_code]) byTemplate[row.template_code] = [];
      byTemplate[row.template_code].push(row);
    }
    return templates.map(t => ({
      ...t,
      linked_majors: byTemplate[t.template_code] || [],
      validation_ids: [ ...new Set((byTemplate[t.template_code] || [])
        .map(m => m.default_validation_id).filter(Boolean)) ],
    }));
  }

  async getValidationsForScheme(schemeId) {
    if (!schemeId) return [];
    return this.app.model.query(
      `SELECT v.validation_id, v.name, p.is_primary
       FROM test_scheme_validation_pair p
       JOIN test_validation_enum v ON v.validation_id = p.validation_id
       WHERE p.scheme_id = :schemeId
       ORDER BY p.is_primary DESC, v.validation_id`,
      { replacements: { schemeId }, type: QueryTypes.SELECT },
    );
  }

  async updateMajorTemplate(categoryMajorId, templateCode) {
    if (MIXED_TS_MAJORS.has(categoryMajorId)) {
      const err = new Error('混合 TS 大类不支持大类级模板切换');
      err.status = 400;
      throw err;
    }
    const meta = await this.getTemplateMeta(templateCode);
    if (!meta) {
      const err = new Error('模板不存在');
      err.status = 404;
      throw err;
    }
    await this.app.model.query(
      `INSERT INTO test_category_major_template (category_major_id, template_code, note)
       VALUES (:majorId, :code, :note)
       ON CONFLICT (category_major_id) DO UPDATE
         SET template_code = EXCLUDED.template_code, note = EXCLUDED.note`,
      {
        replacements: {
          majorId: categoryMajorId,
          code: templateCode,
          note: meta.name,
        },
      },
    );
    await this.app.model.query(
      `UPDATE test_category_major SET default_scheme_id = :schemeId
       WHERE category_major_id = :majorId`,
      { replacements: { majorId: categoryMajorId, schemeId: meta.scheme_id } },
    );
    return this.getTemplateByMajor(categoryMajorId);
  }

  async updateMajorValidation(categoryMajorId, validationId) {
    const majorRows = await this.app.model.query(
      `SELECT m.default_scheme_id, mt.template_code, t.scheme_id
       FROM test_category_major m
       LEFT JOIN test_category_major_template mt ON mt.category_major_id = m.category_major_id
       LEFT JOIN config_template_enum t ON t.template_code = mt.template_code
       WHERE m.category_major_id = :majorId LIMIT 1`,
      { replacements: { majorId: categoryMajorId }, type: QueryTypes.SELECT },
    );
    const major = majorRows[0];
    const schemeId = major?.scheme_id || major?.default_scheme_id;
    if (schemeId) {
      const pairs = await this.app.model.query(
        `SELECT validation_id FROM test_scheme_validation_pair
         WHERE scheme_id = :schemeId AND validation_id = :validationId LIMIT 1`,
        { replacements: { schemeId, validationId }, type: QueryTypes.SELECT },
      );
      if (!pairs.length) {
        const err = new Error('验证方案与当前大类方案不兼容');
        err.status = 400;
        throw err;
      }
    }
    await this.app.model.query(
      `UPDATE test_category_major SET default_validation_id = :validationId
       WHERE category_major_id = :majorId`,
      { replacements: { majorId: categoryMajorId, validationId } },
    );
    if (schemeId) {
      await this.app.model.query(
        `UPDATE test_item_detail SET validation_primary_id = :validationId, updated_at = NOW()
         WHERE category_major_id = :majorId AND scheme_primary_id = :schemeId`,
        { replacements: { majorId: categoryMajorId, schemeId, validationId } },
      );
    }
    const rows = await this.app.model.query(
      `SELECT m.*, v.name AS validation_name
       FROM test_category_major m
       LEFT JOIN test_validation_enum v ON v.validation_id = m.default_validation_id
       WHERE m.category_major_id = :majorId`,
      { replacements: { majorId: categoryMajorId }, type: QueryTypes.SELECT },
    );
    return rows[0];
  }

  async updateTemplateValidation(templateCode, validationId) {
    const meta = await this.getTemplateMeta(templateCode);
    if (!meta) {
      const err = new Error('模板不存在');
      err.status = 404;
      throw err;
    }
    const pairs = await this.app.model.query(
      `SELECT validation_id FROM test_scheme_validation_pair
       WHERE scheme_id = :schemeId AND validation_id = :validationId LIMIT 1`,
      { replacements: { schemeId: meta.scheme_id, validationId }, type: QueryTypes.SELECT },
    );
    if (!pairs.length) {
      const err = new Error('验证方案与模板方案不兼容');
      err.status = 400;
      throw err;
    }
    const [, metaResult] = await this.app.model.query(
      `UPDATE test_category_major m SET default_validation_id = :validationId
       FROM test_category_major_template mt
       WHERE mt.category_major_id = m.category_major_id
         AND mt.template_code = :templateCode`,
      { replacements: { templateCode, validationId } },
    );
    await this.app.model.query(
      `UPDATE test_item_detail SET validation_primary_id = :validationId, updated_at = NOW()
       WHERE template_code = :templateCode AND scheme_primary_id = :schemeId`,
      { replacements: { templateCode, validationId, schemeId: meta.scheme_id } },
    );
    return {
      template_code: templateCode,
      validation_id: validationId,
      updated_majors: metaResult?.rowCount ?? 0,
    };
  }

  async getTemplateMeta(templateCode) {
    const rows = await this.app.model.query(
      'SELECT * FROM config_template_enum WHERE template_code = :code LIMIT 1',
      { replacements: { code: templateCode }, type: QueryTypes.SELECT },
    );
    return rows[0] || null;
  }

  async getMajorTemplateMap(categoryMajorId) {
    if (!categoryMajorId) return null;
    const rows = await this.app.model.query(
      `SELECT m.*, t.name AS template_name, t.panel_key, t.scheme_id, t.table_name,
              t.agent_skill, t.agent_action
       FROM test_category_major_template m
       JOIN config_template_enum t ON t.template_code = m.template_code
       WHERE m.category_major_id = :id LIMIT 1`,
      { replacements: { id: categoryMajorId }, type: QueryTypes.SELECT },
    );
    return rows[0] || null;
  }

  async resolveTemplateCodeForItem(item) {
    if (!item) return null;

    if (item.template_code && TEMPLATE_TABLES[item.template_code]) {
      return item.template_code;
    }

    if (MIXED_TS_MAJORS.has(item.category_major_id)) {
      return resolveTemplateCodeFromItem(item);
    }

    const mapped = await this.getMajorTemplateMap(item.category_major_id);
    if (mapped?.template_code) return mapped.template_code;

    return resolveTemplateCodeFromItem(item);
  }

  async loadItem(itemId) {
    const rows = await this.app.model.query(
      'SELECT * FROM test_item_detail WHERE item_id = :itemId LIMIT 1',
      { replacements: { itemId }, type: QueryTypes.SELECT },
    );
    return rows[0] || null;
  }

  async ensureItemTemplateCode(itemId) {
    const item = await this.loadItem(itemId);
    if (!item) {
      const err = new Error('用例不存在');
      err.status = 404;
      throw err;
    }
    const templateCode = await this.resolveTemplateCodeForItem(item);
    if (templateCode && templateCode !== item.template_code) {
      await this.app.model.query(
        'UPDATE test_item_detail SET template_code = :code WHERE item_id = :itemId',
        { replacements: { code: templateCode, itemId } },
      );
      item.template_code = templateCode;
    }
    const meta = await this.getTemplateMeta(templateCode);
    return { item, templateCode, meta };
  }

  _tableForCode(templateCode) {
    const table = TEMPLATE_TABLES[templateCode];
    if (!table) {
      const err = new Error(`未知模板: ${templateCode}`);
      err.status = 400;
      throw err;
    }
    assertTemplateTable(table);
    return table;
  }

  async _resolveConfigContext(itemId, schemeRole = 'primary') {
    const item = await this.loadItem(itemId);
    if (!item) {
      const err = new Error('用例不存在');
      err.status = 404;
      throw err;
    }

    const isSecondary = schemeRole === 'secondary';
    const schemeId = isSecondary ? item.scheme_secondary_id : item.scheme_primary_id;
    if (isSecondary && !schemeId) {
      const err = new Error('未配置辅方案，请先在详情页设置');
      err.status = 400;
      throw err;
    }

    let templateCode;
    if (isSecondary) {
      templateCode = SCHEME_TO_TEMPLATE[schemeId];
    } else {
      templateCode = await this.resolveTemplateCodeForItem(item);
    }
    if (!templateCode) {
      const err = new Error(`方案 ${schemeId || '-'} 无对应配置模板`);
      err.status = 400;
      throw err;
    }

    const meta = await this.getTemplateMeta(templateCode);
    return {
      item,
      schemeId,
      templateCode,
      meta,
      isSecondary,
      scheme_role: isSecondary ? 'secondary' : 'primary',
    };
  }

  async getItemConfig(itemId, options = {}) {
    const schemeRole = options.scheme_role || 'primary';
    const ctx = await this._resolveConfigContext(itemId, schemeRole);

    if (ctx.isSecondary) {
      const runCfg = await this.ctx.service.fitnessExecution.getRunConfig(itemId, ctx.schemeId);
      const defaultConfig = this._defaultConfigFromItem(ctx.item, ctx.templateCode);
      const rc = runCfg?.toJSON ? runCfg.toJSON() : runCfg;
      let configJson = rc?.config_json || defaultConfig.config_json;
      if (rc) {
        configJson = {
          ...configJson,
          use_api_template: rc.use_api_template ?? configJson.use_api_template,
          api_template_id: rc.api_template_id ?? configJson.api_template_id,
          inject_bindings: rc.inject_bindings || configJson.inject_bindings || {},
        };
      }
    return {
      item_id: itemId,
      item: ctx.item,
      scheme_role: 'secondary',
      scheme_id: ctx.schemeId,
      template_code: ctx.templateCode,
      template: { ...ctx.meta, scheme_id: ctx.schemeId },
      config_json: configJson,
      threshold_json: rc?.threshold_json || defaultConfig.threshold_json,
      sample_set_id: rc?.sample_set_id ?? defaultConfig.sample_set_id,
      config_source: 'manual',
      configured: Boolean(runCfg),
      ...buildItemTemplateSwitchMeta(ctx.item, ctx.templateCode),
    };
    }

    const { item, templateCode, meta } = await this.ensureItemTemplateCode(itemId);
    const table = this._tableForCode(templateCode);
    let row = null;
    try {
      const rows = await this.app.model.query(
        `SELECT * FROM "${table}" WHERE item_id = :itemId LIMIT 1`,
        { replacements: { itemId }, type: QueryTypes.SELECT },
      );
      row = rows[0] || null;
    } catch (err) {
      if (!/does not exist/.test(String(err.message))) throw err;
      this.ctx.logger.warn('[configTemplate] 模板表 %s 不存在，返回默认配置', table);
    }
    const defaultConfig = this._defaultConfigFromItem(item, templateCode);
    let configJson = row?.config_json || defaultConfig.config_json;
    const schemeId = meta?.scheme_id || item.scheme_primary_id;
    const validationOptions = await this.getValidationsForScheme(schemeId);
    const defaultValidationId = await resolveDefaultValidationId(
      this.app,
      item,
      schemeId,
      templateCode,
    );
    if (schemeId) {
      const runCfg = await this.ctx.service.fitnessExecution.getRunConfig(itemId, schemeId);
      if (runCfg) {
        const rc = runCfg.toJSON ? runCfg.toJSON() : runCfg;
        configJson = {
          ...configJson,
          use_api_template: rc.use_api_template ?? configJson.use_api_template,
          api_template_id: rc.api_template_id ?? configJson.api_template_id,
          inject_bindings: rc.inject_bindings || configJson.inject_bindings || {},
        };
      }
    }
    return {
      item_id: itemId,
      item,
      scheme_role: 'primary',
      scheme_id: schemeId,
      template_code: templateCode,
      template: meta,
      config_json: configJson,
      threshold_json: row?.threshold_json || defaultConfig.threshold_json,
      sample_set_id: row?.sample_set_id ?? defaultConfig.sample_set_id,
      config_source: row?.config_source || 'manual',
      configured: Boolean(row),
      validation_options: validationOptions,
      default_validation_id: defaultValidationId,
      ...buildItemTemplateSwitchMeta(item, templateCode),
    };
  }

  _defaultConfigFromItem(item, templateCode) {
    const base = {
      endpoint_path: item.endpoint_path,
      http_method: item.http_method,
      test_input_example: item.test_input_example,
      test_steps: item.test_steps,
      assertion_points: item.assertion_points,
      http_status_expected: item.http_status_expected,
    };
    if (templateCode === 'TPL-SET') {
      return { config_json: {}, threshold_json: {}, sample_set_id: null };
    }
    if (templateCode === 'TPL-DET') {
      return { config_json: { ...base }, threshold_json: {} };
    }
    if (templateCode === 'TPL-API-CTX') {
      return {
        config_json: { execution_mode: 'api_ctx', use_agent_judge: true },
        threshold_json: {},
      };
    }
    return { config_json: {}, threshold_json: {} };
  }

  async setItemConfigTemplate(itemId, body = {}) {
    const item = await this.loadItem(itemId);
    if (!item) {
      const err = new Error('用例不存在');
      err.status = 404;
      throw err;
    }
    if (!MIXED_TS_MAJORS.has(item.category_major_id)) {
      const err = new Error('仅混合 TS 大类（教练/会员/管理/横切）支持切换配置模板');
      err.status = 400;
      throw err;
    }

    const upgradeScheme = body.upgrade_scheme !== false;
    let schemeId = item.scheme_primary_id;
    let validationId = item.validation_primary_id;
    const requested = body.template_code;
    if (requested == null || requested === '') {
      const err = new Error('template_code 必填');
      err.status = 400;
      throw err;
    }

    let storedTemplateCode = normalizeStoredTemplateCode(requested, schemeId);

    if (requested === API_CTX_TEMPLATE || storedTemplateCode === API_CTX_TEMPLATE) {
      if (schemeId !== API_CTX_SCHEME) {
        if (!upgradeScheme) {
          const err = new Error('TPL-API-CTX 需要主方案 TS-05-API，请确认 upgrade_scheme');
          err.status = 400;
          throw err;
        }
        schemeId = API_CTX_SCHEME;
        const pairs = await this.getValidationsForScheme(schemeId);
        const stillValid = pairs.some(p => p.validation_id === validationId);
        if (!stillValid) {
          validationId = pairs.find(p => p.is_primary)?.validation_id || 'VS-04-CHAIN-OK';
        }
        const tplDefault = await resolveDefaultValidationId(
          this.app,
          item,
          schemeId,
          API_CTX_TEMPLATE,
        );
        if (tplDefault && await isValidationCompatibleWithScheme(this.app, schemeId, tplDefault)) {
          validationId = tplDefault;
        }
      }
      storedTemplateCode = normalizeStoredTemplateCode(API_CTX_TEMPLATE, schemeId);
    } else if (requested === 'TPL-CHAIN') {
      if (upgradeScheme && schemeId !== CHAIN_SCHEME) {
        schemeId = CHAIN_SCHEME;
        const pairs = await this.getValidationsForScheme(schemeId);
        const stillValid = pairs.some(p => p.validation_id === validationId);
        if (!stillValid) {
          validationId = pairs.find(p => p.is_primary)?.validation_id || 'VS-04-CHAIN-OK';
        }
      }
      storedTemplateCode = normalizeStoredTemplateCode('TPL-CHAIN', schemeId);
    } else {
      const alts = SCHEME_TEMPLATE_ALTERNATIVES[schemeId] || [];
      const effective = storedTemplateCode || SCHEME_TO_TEMPLATE[schemeId];
      if (!alts.includes(effective)) {
        const err = new Error(`主方案 ${schemeId} 不支持配置模板 ${requested}`);
        err.status = 400;
        throw err;
      }
    }

    await this.app.model.query(
      `UPDATE test_item_detail SET
         template_code = :templateCode,
         scheme_primary_id = :schemeId,
         validation_primary_id = :validationId,
         updated_at = NOW()
       WHERE item_id = :itemId`,
      {
        replacements: {
          itemId,
          templateCode: storedTemplateCode,
          schemeId,
          validationId,
        },
      },
    );

    return this.getItemConfig(itemId, { scheme_role: 'primary' });
  }

  async saveItemConfig(itemId, body = {}) {
    const schemeRole = body.scheme_role || 'primary';
    const ctx = await this._resolveConfigContext(itemId, schemeRole);

    if (ctx.isSecondary) {
      let configJson = body.config_json || {};
      if (ctx.templateCode === 'TPL-DET') {
        configJson = normalizeDetConfigJson(configJson);
      }
      const thresholdJson = body.threshold_json || {};
      const sampleSetId = body.sample_set_id ?? configJson.sample_set_id ?? null;
      await this.ctx.service.fitnessExecution.saveRunConfig(itemId, {
        scheme_id: ctx.schemeId,
        config_json: configJson,
        threshold_json: thresholdJson,
        sample_set_id: sampleSetId,
        env_id: body.env_id,
        api_template_id: configJson.api_template_id ?? null,
        use_api_template: Boolean(configJson.use_api_template),
        inject_bindings: configJson.inject_bindings || {},
      });
      return this.getItemConfig(itemId, { scheme_role: 'secondary' });
    }

    const { item, templateCode, meta } = await this.ensureItemTemplateCode(itemId);
    const table = this._tableForCode(templateCode);
    let configJson = body.config_json || {};
    if (templateCode === 'TPL-DET') {
      configJson = normalizeDetConfigJson(configJson);
    }
    if (templateCode === 'TPL-API-CTX') {
      configJson = {
        ...configJson,
        execution_mode: 'api_ctx',
        use_agent_judge: configJson.use_agent_judge !== false,
      };
    }
    const thresholdJson = body.threshold_json || {};
    const configSource = body.config_source || 'manual';
    const sampleSetId = body.sample_set_id ?? configJson.sample_set_id ?? null;

    const existingRows = await this.app.model.query(
      `SELECT item_id FROM "${table}" WHERE item_id = :itemId LIMIT 1`,
      { replacements: { itemId }, type: QueryTypes.SELECT },
    );
    const existing = existingRows[0];

    if (existing) {
      if (table === 'tpl_config_set') {
        await this.app.model.query(
          `UPDATE "${table}" SET config_json = :configJson::jsonb, threshold_json = :thresholdJson::jsonb,
           config_source = :configSource, sample_set_id = :sampleSetId, updated_at = NOW()
           WHERE item_id = :itemId`,
          {
            replacements: {
              itemId,
              configJson: JSON.stringify(configJson),
              thresholdJson: JSON.stringify(thresholdJson),
              configSource,
              sampleSetId,
            },
          },
        );
      } else {
        await this.app.model.query(
          `UPDATE "${table}" SET config_json = :configJson::jsonb, threshold_json = :thresholdJson::jsonb,
           config_source = :configSource, updated_at = NOW() WHERE item_id = :itemId`,
          {
            replacements: {
              itemId,
              configJson: JSON.stringify(configJson),
              thresholdJson: JSON.stringify(thresholdJson),
              configSource,
            },
          },
        );
      }
    } else if (table === 'tpl_config_set') {
      await this.app.model.query(
        `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source, sample_set_id)
         VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, :configSource, :sampleSetId)`,
        {
          replacements: {
            itemId,
            configJson: JSON.stringify(configJson),
            thresholdJson: JSON.stringify(thresholdJson),
            configSource,
            sampleSetId,
          },
        },
      );
    } else {
      await this.app.model.query(
        `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source)
         VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, :configSource)`,
        {
          replacements: {
            itemId,
            configJson: JSON.stringify(configJson),
            thresholdJson: JSON.stringify(thresholdJson),
            configSource,
          },
        },
      );
    }

    await this.ctx.service.fitnessExecution.saveRunConfig(itemId, {
      scheme_id: meta?.scheme_id || body.scheme_id,
      config_json: configJson,
      threshold_json: thresholdJson,
      sample_set_id: sampleSetId,
      env_id: body.env_id,
      api_template_id: configJson.api_template_id ?? null,
      use_api_template: Boolean(
        configJson.use_api_template
        || templateCode === 'TPL-API-CTX'
        || configJson.execution_mode === 'api_ctx',
      ),
      inject_bindings: configJson.inject_bindings || {},
    });

    if ('validation_primary_id' in body || body.validation_secondary_id != null) {
      const primaryId = body.validation_primary_id ?? null;
      const secondaryId = body.validation_secondary_id ?? null;
      const schemeId = meta?.scheme_id || item.scheme_primary_id;
      if (primaryId) {
        const compatible = await isValidationCompatibleWithScheme(this.app, schemeId, primaryId);
        if (!compatible) {
          const err = new Error('主验证与方案不匹配');
          err.status = 400;
          throw err;
        }
      }
      await this.app.model.query(
        `UPDATE test_item_detail SET
           validation_primary_id = :primaryId,
           validation_secondary_id = :secondaryId,
           updated_at = NOW()
         WHERE item_id = :itemId`,
        {
          replacements: {
            itemId,
            primaryId,
            secondaryId,
          },
        },
      );
    }

    if (templateCode === 'TPL-DET') {
      const httpMethod = configJson.http_method || configJson.method;
      await this.app.model.query(
        `UPDATE test_item_detail SET
           endpoint_path = COALESCE(:endpointPath, endpoint_path),
           http_method = COALESCE(:httpMethod, http_method),
           http_status_expected = COALESCE(:httpStatus, http_status_expected),
           test_input_example = COALESCE(:testInput, test_input_example)
         WHERE item_id = :itemId`,
        {
          replacements: {
            itemId,
            endpointPath: configJson.endpoint_path || null,
            httpMethod: httpMethod || null,
            httpStatus: configJson.http_status_expected ?? null,
            testInput: configJson.test_input_example || null,
          },
        },
      );
    }

    return this.getItemConfig(itemId, { scheme_role: 'primary' });
  }

  async generateItemConfig(itemId, body = {}) {
    const { item, templateCode, meta } = await this.ensureItemTemplateCode(itemId);
    if (!meta?.agent_skill) {
      const err = new Error('该模板不支持 Agent 自动生成');
      err.status = 400;
      throw err;
    }

    let generated;
    if (meta.agent_skill === 'fitness-sample-skill') {
      const res = await this.ctx.service.agentProxy.invokeFitnessSample({
        action: meta.agent_action || 'from_example',
        scheme_id: meta.scheme_id,
        test_input_example: item.test_input_example,
        item_id: itemId,
        trace: { item_id: itemId },
      });
      const output = res.output || res;
      generated = {
        config_json: { sample_set_id: body.sample_set_id || null },
        threshold_json: output.threshold_json || {},
        sample_set_id: body.sample_set_id || null,
        samples: output.samples,
      };
    } else {
      const res = await this.ctx.service.agentProxy.invokeFitnessConfig({
        action: meta.agent_action || 'generate_config',
        template_code: templateCode,
        scheme_id: meta.scheme_id,
        item: {
          item_id: item.item_id,
          detail_summary: item.detail_summary,
          expected_observation: item.expected_observation,
          test_input_example: item.test_input_example,
          test_steps: item.test_steps,
          assertion_points: item.assertion_points,
          endpoint_path: item.endpoint_path,
          http_method: item.http_method,
          http_status_expected: item.http_status_expected,
          automation_command: item.automation_command,
          category_major_id: item.category_major_id,
          validation_primary_id: item.validation_primary_id,
        },
        trace: { item_id: itemId },
      });
      const output = res.output || res;
      generated = {
        config_json: output.config_json || output.config || {},
        threshold_json: output.threshold_json || output.threshold || {},
      };
    }

    if (body.auto_save) {
      return this.saveItemConfig(itemId, {
        ...generated,
        config_source: 'agent',
      });
    }

    return {
      item_id: itemId,
      template_code: templateCode,
      template: meta,
      ...generated,
      config_source: 'agent',
    };
  }

  async getTemplateByMajor(categoryMajorId) {
    if (MIXED_TS_MAJORS.has(categoryMajorId)) {
      return {
        category_major_id: categoryMajorId,
        is_mixed: true,
        template_code: null,
        message: '混合 TS 大类，用例级按 scheme 解析模板',
      };
    }
    const mapped = await this.getMajorTemplateMap(categoryMajorId);
    if (!mapped) {
      const err = new Error('大类未挂载模板');
      err.status = 404;
      throw err;
    }
    return { ...mapped, is_mixed: false };
  }
}

module.exports = ConfigTemplateService;
