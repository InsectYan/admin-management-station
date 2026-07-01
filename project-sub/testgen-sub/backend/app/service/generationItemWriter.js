'use strict';

const { mapAgentCaseToItemDetail } = require('../lib/generationItemMapper');
const {
  loadMajorContext,
  resolveTemplateCodeForGeneration,
  seedTemplateConfigs,
} = require('../lib/generationTemplateHelper');

/** test_item_detail 可写入列（config_json/threshold_json 走模板子表） */
const INSERT_COLS = [
  'item_id', 'project_code', 'project_name', 'generation_job_id',
  'dimension_id', 'category_major_id', 'category_minor_id', 'template_code',
  'sub_class', 'item_name', 'detail_summary', 'expected_observation', 'test_input_example',
  'preconditions', 'test_steps', 'assertion_points', 'priority_id',
  'scheme_primary_id', 'validation_primary_id',
  'automation_status_id', 'station_id', 'role_scope_id', 'exec_env_id', 'env_tier_id',
  'endpoint_path', 'http_method', 'http_status_expected',
  'source_doc', 'source_section', 'tags', 'notes', 'scheme_mapping_source', 'is_active',
];

const JSONB_COLS = new Set([ 'preconditions', 'test_steps', 'assertion_points', 'tags' ]);

function cellValue(row, col) {
  let val = row[col];
  if (val === undefined) return null;
  if (JSONB_COLS.has(col) && val != null) return JSON.stringify(val);
  return val;
}

class GenerationItemWriterService extends require('egg').Service {
  /**
   * @param {Record<string, unknown>[]} rawCases
   * @param {object} ctx
   */
  async bulkInsertItems(rawCases, ctx) {
    if (!rawCases.length) return [];

    let majorMeta = null;
    if (ctx.category_major_id) {
      majorMeta = await loadMajorContext(this.app, ctx.category_major_id);
    }
    const templateCode = ctx.template_code
      || await resolveTemplateCodeForGeneration(
        this.app,
        ctx.category_major_id,
        ctx.scheme_id,
      );

    const enrichedCtx = {
      ...ctx,
      template_code: templateCode,
      dimension_id: majorMeta?.dimension_id,
      category_minor_id: majorMeta?.category_minor_id,
    };

    const usedIds = new Set();
    const rows = [];

    rawCases.forEach((tc, index) => {
      let row = mapAgentCaseToItemDetail(tc, enrichedCtx, index);
      let n = 2;
      while (usedIds.has(row.item_id)) {
        row = { ...row, item_id: `${row.item_id.slice(0, 58)}-${n}` };
        n += 1;
      }
      usedIds.add(row.item_id);
      rows.push(row);
    });

    const replacements = {};
    const placeholders = rows.map((row, ri) => {
      const cells = INSERT_COLS.map(col => {
        const key = `r${ri}_${col}`;
        replacements[key] = cellValue(row, col);
        return JSONB_COLS.has(col) ? `:${key}::jsonb` : `:${key}`;
      });
      return `(${cells.join(', ')})`;
    });

    const sql = `
      INSERT INTO test_item_detail (${INSERT_COLS.map(c => `"${c}"`).join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (item_id) DO NOTHING
      RETURNING item_id
    `;

    const [ result ] = await this.app.model.query(sql, { replacements });
    const itemIds = (result || []).map(r => r.item_id);
    const insertedRows = rows.filter(r => itemIds.includes(r.item_id));
    await seedTemplateConfigs(this.app, insertedRows);
    return itemIds;
  }
}

module.exports = GenerationItemWriterService;
