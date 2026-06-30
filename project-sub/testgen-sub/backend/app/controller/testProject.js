'use strict';

const Controller = require('egg').Controller;

class TestProjectController extends Controller {
  async index() {
    const data = await this.service.testProject.list();
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async show() {
    const project = await this.service.testProject.findByCode(this.ctx.params.projectCode);
    if (!project) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '项目不存在', data: null };
      return;
    }
    const stats = await this.service.testProject.stats(this.ctx.params.projectCode);
    this.ctx.body = { code: 0, message: 'ok', data: { ...project.toJSON(), stats } };
  }

  async create() {
    try {
      const data = await this.service.testProject.create(this.ctx.request.body || {});
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async update() {
    const data = await this.service.testProject.update(
      this.ctx.params.projectCode,
      this.ctx.request.body || {},
    );
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '项目不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async destroy() {
    const ok = await this.service.testProject.destroy(this.ctx.params.projectCode);
    if (!ok) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '项目不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'deleted', data: null };
  }

  async listEnvironments() {
    try {
      const data = await this.service.projectEnv.listEnvironments(this.ctx.params.projectCode);
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async createEnvironment() {
    try {
      const data = await this.service.projectEnv.createEnvironment(
        this.ctx.params.projectCode,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async updateEnvironment() {
    try {
      const data = await this.service.projectEnv.updateEnvironment(
        this.ctx.params.projectCode,
        this.ctx.params.envId,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async deleteEnvironment() {
    try {
      await this.service.projectEnv.deleteEnvironment(
        this.ctx.params.projectCode,
        this.ctx.params.envId,
      );
      this.ctx.body = { code: 0, message: 'deleted', data: null };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async syncEnvironments() {
    try {
      const data = await this.service.projectEnv.syncEnvironments(
        this.ctx.params.projectCode,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async listVariables() {
    const data = await this.service.projectEnv.listVariables(this.ctx.params.projectCode);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async saveVariables() {
    try {
      await this.service.projectEnv.saveVariables(
        this.ctx.params.projectCode,
        this.ctx.request.body || {},
      );
      this.ctx.body = { code: 0, message: 'ok', data: null };
    } catch (err) {
      this.ctx.status = err.status || 501;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }

  async healthStatus() {
    try {
      const data = await this.service.projectEnv.healthStatus(this.ctx.params.projectCode);
      this.ctx.body = { code: 0, message: 'ok', data };
    } catch (err) {
      this.ctx.status = err.status || 500;
      this.ctx.body = { code: this.ctx.status, message: err.message, data: null };
    }
  }
}

module.exports = TestProjectController;
