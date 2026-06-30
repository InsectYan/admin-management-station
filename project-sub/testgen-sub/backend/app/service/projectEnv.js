'use strict';

const { Op } = require('sequelize');
const { probeEnvironment, sanitizeEnv, pickEnvFields } = require('../lib/projectEnvProbe');

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
    return sanitizeEnv(row);
  }

  async updateEnvironment(projectCode, envId, payload) {
    const row = await this.findEnv(projectCode, envId);
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
    return sanitizeEnv(row);
  }

  async deleteEnvironment(projectCode, envId) {
    const row = await this.findEnv(projectCode, envId);
    await row.destroy();
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

  // ── 全局变量（后续实现） ──

  async listVariables(_projectCode) {
    return { list: [], total: 0 };
  }

  async saveVariables(_projectCode, _payload) {
    const err = new Error('全局变量保存服务端尚未实现');
    err.status = 501;
    throw err;
  }
}

module.exports = ProjectEnvService;
