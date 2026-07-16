'use strict';

const { Op } = require('sequelize');
const { probeEnvironment, sanitizeEnv, pickEnvFields } = require('../lib/projectEnvProbe');
const {
  upsertExecutionEnvFromTemplate,
  deleteSyncedExecutionEnv,
} = require('../lib/projectEnvToExecution');

class ProjectEnvService extends require('egg').Service {
  async assertProject(projectCode) {
    const project = await this.ctx.model.TestProject.findByPk(projectCode);
    if (!project) {
      const err = new Error('项目不存在');
      err.status = 404;
      throw err;
    }
    return project;
  }

  async listEnvironments(projectCode) {
    await this.assertProject(projectCode);
    const rows = await this.ctx.model.ProjectEnvTemplate.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return {
      list: rows.map(r => sanitizeEnv(r)),
      total: rows.length,
    };
  }

  async findEnv(projectCode, envId) {
    const row = await this.ctx.model.ProjectEnvTemplate.findOne({
      where: { id: envId, project_code: projectCode },
    });
    if (!row) {
      const err = new Error('环境不存在');
      err.status = 404;
      throw err;
    }
    return row;
  }

  async createEnvironment(projectCode, payload) {
    await this.assertProject(projectCode);
    if (!payload.name) {
      const err = new Error('环境名称为必填项');
      err.status = 400;
      throw err;
    }
    const dup = await this.ctx.model.ProjectEnvTemplate.findOne({
      where: { project_code: projectCode, name: payload.name },
    });
    if (dup) {
      const err = new Error('同名环境已存在');
      err.status = 409;
      throw err;
    }
    const row = await this.ctx.model.ProjectEnvTemplate.create({
      project_code: projectCode,
      ...pickEnvFields(payload),
    });
    const execCount = await this.ctx.model.FtExecutionEnv.count({
      where: { project_code: projectCode },
    });
    await upsertExecutionEnvFromTemplate(this.ctx, row.toJSON(), {
      preferDefault: execCount === 0,
    });
    return sanitizeEnv(row);
  }

  async updateEnvironment(projectCode, envId, payload) {
    const row = await this.findEnv(projectCode, envId);
    const prevName = row.name;
    if (payload.name && payload.name !== row.name) {
      const dup = await this.ctx.model.ProjectEnvTemplate.findOne({
        where: {
          project_code: projectCode,
          name: payload.name,
          id: { [Op.ne]: envId },
        },
      });
      if (dup) {
        const err = new Error('同名环境已存在');
        err.status = 409;
        throw err;
      }
    }
    await row.update(pickEnvFields(payload, row));
    await row.reload();
    if (payload.name && payload.name !== prevName) {
      await deleteSyncedExecutionEnv(this.ctx, projectCode, prevName);
    }
    await upsertExecutionEnvFromTemplate(this.ctx, row.toJSON(), { preferDefault: false });
    return sanitizeEnv(row);
  }

  async deleteEnvironment(projectCode, envId) {
    const row = await this.findEnv(projectCode, envId);
    const name = row.name;
    await row.destroy();
    await deleteSyncedExecutionEnv(this.ctx, projectCode, name);
    return true;
  }

  async syncEnvironments(projectCode, payload) {
    const { source, targets = [], fields = [] } = payload;
    if (!source || !targets.length || !fields.length) {
      const err = new Error('请选择源环境、目标环境与同步范围');
      err.status = 400;
      throw err;
    }
    const all = await this.ctx.model.ProjectEnvTemplate.findAll({
      where: { project_code: projectCode },
    });
    const byName = Object.fromEntries(all.map(r => [ r.name, r ]));
    const src = byName[source];
    if (!src) {
      const err = new Error('源环境不存在');
      err.status = 404;
      throw err;
    }

    const fieldMap = {
      base_url: [ 'base_url' ],
      base_path: [ 'base_path' ],
      auth: [ 'auth_type', 'auth_secret' ],
      database: [ 'db_host', 'db_port', 'db_name', 'db_user', 'db_password' ],
    };

    const updated = [];
    for (const targetName of targets) {
      const target = byName[targetName];
      if (!target) continue;
      const patch = {};
      for (const group of fields) {
        for (const col of (fieldMap[group] || [])) {
          patch[col] = src[col];
        }
      }
      await target.update(patch);
      updated.push(targetName);
    }

    return {
      source,
      targets: updated,
      fields,
      synced_at: new Date().toISOString(),
    };
  }

  async healthStatus(projectCode) {
    await this.assertProject(projectCode);
    const rows = await this.ctx.model.ProjectEnvTemplate.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const timeoutMs = this.app.config.projectEnv?.healthTimeoutMs || 10000;
    const environments = await Promise.all(
      rows.map(row => probeEnvironment(this.ctx, row.toJSON(), { timeoutMs })),
    );
    return {
      checked_at: new Date().toISOString(),
      environments,
    };
  }

  // ── 全局变量 ──

  mapVariableRow(row) {
    return {
      key: row.var_key,
      value: row.var_value || '',
      source: row.source || 'manual',
      extract_path: row.extract_path || '',
      from_step: row.from_step || '',
    };
  }

  async listVariables(projectCode) {
    await this.assertProject(projectCode);
    const rows = await this.ctx.model.ProjectEnvVariable.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const list = rows.map(r => this.mapVariableRow(r));
    return { list, total: list.length };
  }

  async saveVariables(projectCode, payload) {
    await this.assertProject(projectCode);
    const variables = payload?.variables;
    if (!Array.isArray(variables)) {
      const err = new Error('variables 必须为数组');
      err.status = 400;
      throw err;
    }
    const keys = new Set();
    for (const v of variables) {
      const key = (v.key || '').trim();
      if (!key) {
        const err = new Error('变量名不能为空');
        err.status = 400;
        throw err;
      }
      if (keys.has(key)) {
        const err = new Error(`变量名重复: ${key}`);
        err.status = 409;
        throw err;
      }
      keys.add(key);
    }

    await this.ctx.model.sequelize.transaction(async transaction => {
      await this.ctx.model.ProjectEnvVariable.destroy({
        where: { project_code: projectCode },
        transaction,
      });
      if (variables.length) {
        await this.ctx.model.ProjectEnvVariable.bulkCreate(
          variables.map((v, i) => ({
            project_code: projectCode,
            var_key: v.key.trim(),
            var_value: v.value ?? '',
            source: v.source || 'manual',
            extract_path: v.extract_path || null,
            from_step: v.from_step || null,
            sort_order: i,
          })),
          { transaction },
        );
      }
    });

    return this.listVariables(projectCode);
  }

  mapHeaderRow(row) {
    return {
      key: row.header_key,
      value: row.header_value || '',
    };
  }

  async listRequestHeaders(projectCode) {
    await this.assertProject(projectCode);
    const rows = await this.ctx.model.ProjectRequestHeader.findAll({
      where: { project_code: projectCode },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const list = rows.map(r => this.mapHeaderRow(r));
    return { list, total: list.length };
  }

  async saveRequestHeaders(projectCode, payload) {
    await this.assertProject(projectCode);
    const headers = payload?.headers;
    if (!Array.isArray(headers)) {
      const err = new Error('headers 必须为数组');
      err.status = 400;
      throw err;
    }
    const keys = new Set();
    for (const h of headers) {
      const key = String(h.key || '').trim();
      if (!key) {
        const err = new Error('请求头名称不能为空');
        err.status = 400;
        throw err;
      }
      if (keys.has(key.toLowerCase())) {
        const err = new Error(`请求头名称重复: ${key}`);
        err.status = 409;
        throw err;
      }
      keys.add(key.toLowerCase());
    }

    await this.ctx.model.sequelize.transaction(async transaction => {
      await this.ctx.model.ProjectRequestHeader.destroy({
        where: { project_code: projectCode },
        transaction,
      });
      if (headers.length) {
        await this.ctx.model.ProjectRequestHeader.bulkCreate(
          headers.map((h, i) => ({
            project_code: projectCode,
            header_key: String(h.key).trim(),
            header_value: h.value == null ? '' : String(h.value),
            sort_order: i,
          })),
          { transaction },
        );
      }
    });

    return this.listRequestHeaders(projectCode);
  }
}

module.exports = ProjectEnvService;
