'use strict';

const { QueryTypes } = require('sequelize');
const {
  MIXED_TS_MAJORS,
  SCHEME_TO_TEMPLATE,
  TEMPLATE_TABLES,
  assertTemplateTable,
  resolveTemplateCodeFromItem,
} = require('../lib/configTemplateRegistry');
const { normalizeDetConfigJson } = require('../lib/httpRequestBody');

class ConfigTemplateService extends require('egg').Service {
  async listTemplates() {
    const rows = await this.app.model.query(
      'SELECT * FROM config_template_enum ORDER BY sort_order ASC',
      { type: QueryTypes.SELECT },
    );
    return rows;
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

    if (MIXED_TS_MAJORS.has(item.category_major_id)) {
      const schemeId = item.scheme_primary_id || item.scheme_primary;
      return SCHEME_TO_TEMPLATE[schemeId] || item.template_code || 'TPL-DET';
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

  async getItemConfig(itemId) {
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
    return {
      item_id: itemId,
      item,
      template_code: templateCode,
      template: meta,
      config_json: row?.config_json || defaultConfig.config_json,
      threshold_json: row?.threshold_json || defaultConfig.threshold_json,
      sample_set_id: row?.sample_set_id ?? defaultConfig.sample_set_id,
      config_source: row?.config_source || 'manual',
      configured: Boolean(row),
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
    return { config_json: {}, threshold_json: {} };
  }

  async saveItemConfig(itemId, body = {}) {
    const { templateCode, meta } = await this.ensureItemTemplateCode(itemId);
    const table = this._tableForCode(templateCode);
    let configJson = body.config_json || {};
    if (templateCode === 'TPL-DET') {
      configJson = normalizeDetConfigJson(configJson);
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
    });

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

    return this.getItemConfig(itemId);
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
