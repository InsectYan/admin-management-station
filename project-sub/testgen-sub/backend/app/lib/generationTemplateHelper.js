'use strict';

const { QueryTypes } = require('sequelize');
const {
  MIXED_TS_MAJORS,
  SCHEME_TO_TEMPLATE,
  TEMPLATE_TABLES,
} = require('./configTemplateRegistry');

/**
 * @param {import('egg').Application} app
 * @param {string} categoryMajorId
 */
async function loadMajorContext(app, categoryMajorId) {
  if (!categoryMajorId) return null;
  const rows = await app.model.query(
    `SELECT cm.category_major_id, cm.dimension_id, cm.name AS category_major_name,
            cn.category_minor_id
     FROM test_category_major cm
     LEFT JOIN LATERAL (
       SELECT category_minor_id FROM test_category_minor
       WHERE category_major_id = cm.category_major_id
       ORDER BY sort_order ASC, category_minor_id ASC
       LIMIT 1
     ) cn ON true
     WHERE cm.category_major_id = :id
     LIMIT 1`,
    { replacements: { id: categoryMajorId }, type: QueryTypes.SELECT },
  );
  return rows[0] || null;
}

/**
 * @param {import('egg').Application} app
 * @param {string} categoryMajorId
 * @param {string} [schemeId]
 */
async function resolveTemplateCodeForGeneration(app, categoryMajorId, schemeId) {
  if (categoryMajorId && !MIXED_TS_MAJORS.has(categoryMajorId)) {
    const rows = await app.model.query(
      `SELECT template_code FROM test_category_major_template
       WHERE category_major_id = :id LIMIT 1`,
      { replacements: { id: categoryMajorId }, type: QueryTypes.SELECT },
    );
    if (rows[0]?.template_code) return rows[0].template_code;
  }
  return SCHEME_TO_TEMPLATE[schemeId] || 'TPL-DET';
}

/**
 * @param {string} templateCode
 * @param {Record<string, unknown>} item
 */
function buildTemplateDefaults(templateCode, item) {
  if (item.config_json && typeof item.config_json === 'object' && Object.keys(item.config_json).length) {
    return {
      config_json: item.config_json,
      threshold_json: item.threshold_json && typeof item.threshold_json === 'object'
        ? item.threshold_json
        : {},
    };
  }
  const base = {
    endpoint_path: item.endpoint_path,
    http_method: item.http_method,
    method: item.http_method,
    test_input_example: item.test_input_example,
    test_steps: item.test_steps,
    assertion_points: item.assertion_points,
    http_status_expected: item.http_status_expected,
  };
  if (templateCode === 'TPL-SET') {
    return { config_json: {}, threshold_json: {} };
  }
  if (templateCode === 'TPL-DET') {
    return { config_json: { ...base }, threshold_json: {} };
  }
  if (templateCode === 'TPL-BND') {
    return {
      config_json: {
        matrix: item.config_json?.matrix || [],
        endpoint_path: item.endpoint_path,
        http_method: item.http_method,
      },
      threshold_json: {},
    };
  }
  if (templateCode === 'TPL-REP') {
    return {
      config_json: {
        repeat_count: 3,
        path: item.endpoint_path || '/health',
        method: item.http_method || 'GET',
        expect_status: item.http_status_expected || 200,
      },
      threshold_json: { passk_N: 3, passk_M: 3 },
    };
  }
  return { config_json: {}, threshold_json: {} };
}

/**
 * @param {import('egg').Application} app
 * @param {Record<string, unknown>[]} rows
 */
async function seedTemplateConfigs(app, rows) {
  for (const row of rows) {
    const templateCode = row.template_code;
    const itemId = row.item_id;
    if (!templateCode || !itemId) continue;
    const table = TEMPLATE_TABLES[templateCode];
    if (!table) continue;

    const { config_json, threshold_json } = buildTemplateDefaults(templateCode, row);
    try {
      if (table === 'tpl_config_set') {
        await app.model.query(
          `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source, sample_set_id)
           VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, 'generation', NULL)
           ON CONFLICT (item_id) DO NOTHING`,
          {
            replacements: {
              itemId,
              configJson: JSON.stringify(config_json),
              thresholdJson: JSON.stringify(threshold_json),
            },
          },
        );
      } else {
        await app.model.query(
          `INSERT INTO "${table}" (item_id, config_json, threshold_json, config_source)
           VALUES (:itemId, :configJson::jsonb, :thresholdJson::jsonb, 'generation')
           ON CONFLICT (item_id) DO NOTHING`,
          {
            replacements: {
              itemId,
              configJson: JSON.stringify(config_json),
              thresholdJson: JSON.stringify(threshold_json),
            },
          },
        );
      }
    } catch (err) {
      if (!/does not exist/.test(String(err.message))) throw err;
      app.logger.warn('[generationTemplate] 模板表 %s 不存在，跳过 %s', table, itemId);
    }
  }
}

/**
 * @param {import('egg').Application} app
 * @param {string} categoryMajorId
 */
async function loadMajorGenerationProfile(app, categoryMajorId) {
  if (!categoryMajorId) return null;
  const rows = await app.model.query(
    `SELECT cm.category_major_id, cm.dimension_id, cm.name AS category_major_name,
            cm.default_scheme_id, cm.default_validation_id,
            cn.category_minor_id,
            m.template_code AS mapped_template_code,
            ct.name AS template_name,
            ct.scheme_id AS template_scheme_id,
            ts.name AS scheme_name,
            ts_def.name AS default_scheme_name,
            vs_def.name AS default_validation_name
     FROM test_category_major cm
     LEFT JOIN LATERAL (
       SELECT category_minor_id FROM test_category_minor
       WHERE category_major_id = cm.category_major_id
       ORDER BY sort_order ASC, category_minor_id ASC
       LIMIT 1
     ) cn ON true
     LEFT JOIN test_category_major_template m ON m.category_major_id = cm.category_major_id
     LEFT JOIN config_template_enum ct ON ct.template_code = m.template_code
     LEFT JOIN test_scheme_enum ts ON ts.scheme_id = COALESCE(ct.scheme_id, cm.default_scheme_id)
     LEFT JOIN test_scheme_enum ts_def ON ts_def.scheme_id = cm.default_scheme_id
     LEFT JOIN test_validation_enum vs_def ON vs_def.validation_id = cm.default_validation_id
     WHERE cm.category_major_id = :id
     LIMIT 1`,
    { replacements: { id: categoryMajorId }, type: QueryTypes.SELECT },
  );
  const row = rows[0];
  if (!row) return null;

  const scheme_id = row.template_scheme_id || row.default_scheme_id || 'TS-01-DET';
  const template_code = await resolveTemplateCodeForGeneration(app, categoryMajorId, scheme_id);

  let template_name = row.template_name;
  if (!template_name && template_code) {
    const tRows = await app.model.query(
      'SELECT name FROM config_template_enum WHERE template_code = :code LIMIT 1',
      { replacements: { code: template_code }, type: QueryTypes.SELECT },
    );
    template_name = tRows[0]?.name;
  }

  return {
    ...row,
    scheme_id,
    scheme_name: row.scheme_name || row.default_scheme_name || scheme_id,
    template_code,
    template_name,
    is_mixed: MIXED_TS_MAJORS.has(categoryMajorId),
  };
}

/**
 * @param {import('egg').Application} app
 * @param {{ category_major_ids: string[], validation_ids?: string[], major_counts?: Record<string, number>, default_count?: number }} opts
 */
async function buildSchemeTargetsFromMajors(app, opts = {}) {
  const {
    category_major_ids: majorIds = [],
    validation_ids: validationIds = [],
    major_counts: majorCounts = {},
    default_count: defaultCount = 5,
  } = opts;

  if (!majorIds.length) return [];

  const validationNameMap = new Map();
  if (validationIds.length) {
    const vRows = await app.model.query(
      'SELECT validation_id, name FROM test_validation_enum WHERE validation_id = ANY(:ids)',
      { replacements: { ids: validationIds }, type: QueryTypes.SELECT },
    );
    for (const v of vRows) validationNameMap.set(v.validation_id, v.name);
  }

  const targets = [];
  for (const majorId of majorIds) {
    const profile = await loadMajorGenerationProfile(app, majorId);
    if (!profile) continue;

    const validations = validationIds.length
      ? validationIds
      : [ profile.default_validation_id ].filter(Boolean);

    for (const vid of validations) {
      let validation_name = validationNameMap.get(vid);
      if (!validation_name) {
        const vRows = await app.model.query(
          'SELECT name FROM test_validation_enum WHERE validation_id = :id LIMIT 1',
          { replacements: { id: vid }, type: QueryTypes.SELECT },
        );
        validation_name = vRows[0]?.name || vid;
      }

      targets.push({
        category_major_id: majorId,
        category_major_name: profile.category_major_name,
        dimension_id: profile.dimension_id,
        category_minor_id: profile.category_minor_id,
        template_code: profile.template_code,
        template_name: profile.template_name,
        scheme_id: profile.scheme_id,
        scheme_name: profile.scheme_name,
        validation_id: vid,
        validation_name,
        count: Number(majorCounts[majorId]) || defaultCount,
        is_mixed: profile.is_mixed,
      });
    }
  }
  return targets;
}

module.exports = {
  loadMajorContext,
  loadMajorGenerationProfile,
  resolveTemplateCodeForGeneration,
  buildSchemeTargetsFromMajors,
  buildTemplateDefaults,
  seedTemplateConfigs,
  MIXED_TS_MAJORS,
};
