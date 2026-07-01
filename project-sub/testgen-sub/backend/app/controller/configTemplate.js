'use strict';

const Controller = require('egg').Controller;

class ConfigTemplateController extends Controller {
  async listTemplates() {
    const list = await this.ctx.service.configTemplate.listTemplates();
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async getByMajor() {
    const { majorId } = this.ctx.params;
    const data = await this.ctx.service.configTemplate.getTemplateByMajor(majorId);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async getItemConfig() {
    const { itemId } = this.ctx.params;
    const data = await this.ctx.service.configTemplate.getItemConfig(itemId);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async saveItemConfig() {
    const { itemId } = this.ctx.params;
    const data = await this.ctx.service.configTemplate.saveItemConfig(itemId, this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async generateItemConfig() {
    const { itemId } = this.ctx.params;
    const data = await this.ctx.service.configTemplate.generateItemConfig(itemId, this.ctx.request.body || {});
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = ConfigTemplateController;
