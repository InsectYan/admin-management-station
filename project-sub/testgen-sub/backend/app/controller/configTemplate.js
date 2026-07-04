'use strict';

const Controller = require('egg').Controller;

class ConfigTemplateController extends Controller {
  async listTemplates() {
    const list = await this.ctx.service.configTemplate.listTemplates();
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async listMajorsOverview() {
    const list = await this.ctx.service.configTemplate.listMajorsOverview();
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async listTemplatesOverview() {
    const list = await this.ctx.service.configTemplate.listTemplatesOverview();
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async getSchemeValidations() {
    const { schemeId } = this.ctx.params;
    const list = await this.ctx.service.configTemplate.getValidationsForScheme(schemeId);
    this.ctx.body = { code: 0, message: 'ok', data: list };
  }

  async updateMajorTemplate() {
    const { majorId } = this.ctx.params;
    const { template_code } = this.ctx.request.body || {};
    const data = await this.ctx.service.configTemplate.updateMajorTemplate(majorId, template_code);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async updateMajorValidation() {
    const { majorId } = this.ctx.params;
    const { validation_id } = this.ctx.request.body || {};
    const data = await this.ctx.service.configTemplate.updateMajorValidation(majorId, validation_id);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async updateTemplateValidation() {
    const { templateCode } = this.ctx.params;
    const { validation_id } = this.ctx.request.body || {};
    const data = await this.ctx.service.configTemplate.updateTemplateValidation(templateCode, validation_id);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async getByMajor() {
    const { majorId } = this.ctx.params;
    const data = await this.ctx.service.configTemplate.getTemplateByMajor(majorId);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async getItemConfig() {
    const { itemId } = this.ctx.params;
    const scheme_role = this.ctx.query.scheme_role || 'primary';
    const data = await this.ctx.service.configTemplate.getItemConfig(itemId, { scheme_role });
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
