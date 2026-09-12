'use strict';

const Controller = require('egg').Controller;

class ProjectController extends Controller {
  success(data) {
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  fail(err) {
    const status = err.status || 500;
    this.ctx.status = status;
    this.ctx.body = { code: status, message: err.message || '请求失败' };
  }

  async index() {
    try {
      const data = await this.ctx.service.project.list(this.ctx.query);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async template() {
    this.success(this.ctx.service.project.template());
  }

  async show() {
    try {
      const data = await this.ctx.service.project.findById(this.ctx.params.id);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async create() {
    try {
      const data = await this.ctx.service.project.create(this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async update() {
    try {
      const data = await this.ctx.service.project.update(this.ctx.params.id, this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async destroy() {
    try {
      const data = await this.ctx.service.project.destroy(this.ctx.params.id);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async importFile() {
    try {
      const data = await this.ctx.service.project.importDocument(this.ctx.request.body);
      this.success(data);
    } catch (err) {
      this.fail(err);
    }
  }

  async exportFile() {
    try {
      const row = await this.ctx.service.project.findById(this.ctx.params.id);
      this.success(this.ctx.service.project.exportDocument(row));
    } catch (err) {
      this.fail(err);
    }
  }
}

module.exports = ProjectController;
