'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class TestCaseService extends Service {
  buildFilters(filters) {
    const where = {};
    if (filters.job_id) where.job_id = filters.job_id;
    if (filters.module) where.module = filters.module;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;
    if (filters.status) where.status = filters.status;
    return where;
  }

  async list({ job_id, module, type, priority, status, page = 1, pageSize = 20, page_size } = {}) {
    const size = Number(page_size || pageSize);
    const where = this.buildFilters({ job_id, module, type, priority, status });

    const { count, rows } = await this.ctx.model.TestCase.findAndCountAll({
      where,
      attributes: [
        'id', 'case_id', 'title', 'status', 'confidence', 'compliance',
        'priority', 'module', 'type', 'job_id', 'document_id',
      ],
      limit: size,
      offset: (page - 1) * size,
      order: [[ 'id', 'ASC' ]],
    });

    return {
      list: rows.map(r => r.toJSON()),
      total: count,
      page: Number(page),
      pageSize: size,
    };
  }

  async findById(id) {
    const row = await this.ctx.model.TestCase.findByPk(id);
    return row ? row.toJSON() : null;
  }

  async update(id, payload) {
    const row = await this.ctx.model.TestCase.findByPk(id);
    if (!row) return null;
    await row.update({
      title: payload.title ?? row.title,
      module: payload.module ?? row.module,
      type: payload.type ?? row.type,
      priority: payload.priority ?? row.priority,
      status: payload.status ?? row.status,
      confidence: payload.confidence ?? row.confidence,
      compliance: payload.compliance ?? row.compliance,
      preconditions: payload.preconditions ?? row.preconditions,
      steps: payload.steps ?? row.steps,
      expected: payload.expected ?? row.expected,
      tags: payload.tags ?? row.tags,
    });
    return row.toJSON();
  }

  async delete(id) {
    const row = await this.ctx.model.TestCase.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }

  async export({ format = 'markdown', job_id, module, type } = {}) {
    const where = this.buildFilters({ job_id, module, type });
    const rows = await this.ctx.model.TestCase.findAll({
      where,
      order: [[ 'id', 'ASC' ]],
    });
    const cases = rows.map(r => r.toJSON());

    if (format === 'csv') {
      return this.toCsv(cases);
    }
    return this.toMarkdown(cases);
  }

  toMarkdown(cases) {
    const lines = [ '# 测试用例导出\n' ];
    for (const tc of cases) {
      lines.push(`## ${tc.case_id}: ${tc.title}\n`);
      lines.push(`- **模块**: ${tc.module || '-'}`);
      lines.push(`- **类型**: ${tc.type || '-'}`);
      lines.push(`- **优先级**: ${tc.priority}`);
      lines.push(`- **置信度**: ${tc.confidence}`);
      lines.push(`- **合规**: ${tc.compliance}\n`);
      if (tc.preconditions) lines.push(`**前置条件**: ${tc.preconditions}\n`);
      if (tc.steps?.length) {
        lines.push('**步骤**:');
        tc.steps.forEach((s, i) => {
          const stepText = typeof s === 'string' ? s : (s.action || s.step || JSON.stringify(s));
          lines.push(`${i + 1}. ${stepText}`);
        });
        lines.push('');
      }
      if (tc.expected) lines.push(`**预期结果**: ${tc.expected}\n`);
      lines.push('---\n');
    }
    return lines.join('\n');
  }

  toCsv(cases) {
    const header = [ 'case_id', 'title', 'module', 'type', 'priority', 'status', 'confidence', 'compliance', 'expected' ];
    const escape = v => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = cases.map(tc =>
      header.map(h => escape(tc[h])).join(',')
    );
    return [ header.join(','), ...rows ].join('\n');
  }
}

module.exports = TestCaseService;
