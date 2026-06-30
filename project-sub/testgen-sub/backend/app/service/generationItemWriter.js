'use strict';

const { mapAgentCaseToItemDetail } = require('../lib/generationItemMapper');

class GenerationItemWriterService extends require('egg').Service {
  /**
   * @param {Record<string, unknown>[]} rawCases
   * @param {object} ctx
   */
  async bulkInsertItems(rawCases, ctx) {
    if (!rawCases.length) return [];
    const usedIds = new Set();
    const rows = [];

    rawCases.forEach((tc, index) => {
      let row = mapAgentCaseToItemDetail(tc, ctx, index);
      let n = 2;
      while (usedIds.has(row.item_id)) {
        row = { ...row, item_id: `${row.item_id.slice(0, 58)}-${n}` };
        n += 1;
      }
      usedIds.add(row.item_id);
      rows.push(row);
    });

    const cols = Object.keys(rows[0]);
    const jsonbCols = new Set([ 'preconditions', 'test_steps', 'assertion_points', 'tags', 'prd_ref_ids', 'arch_ref_ids', 'prd_goal_ids' ]);
    const values = [];
    const placeholders = rows.map((row, ri) => {
      const ph = cols.map((c, ci) => {
        let val = row[c];
        if (jsonbCols.has(c) && val != null) val = JSON.stringify(val);
        values.push(val);
        return `$${ri * cols.length + ci + 1}${jsonbCols.has(c) ? '::jsonb' : ''}`;
      });
      return `(${ph.join(', ')})`;
    });

    const sql = `
      INSERT INTO test_item_detail (${cols.map(c => `"${c}"`).join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (item_id) DO NOTHING
      RETURNING item_id
    `;

    const [ result ] = await this.app.model.query(sql, { bind: values });
    return (result || []).map(r => r.item_id);
  }
}

module.exports = GenerationItemWriterService;
