'use strict';

const Controller = require('egg').Controller;

class FitnessAssetController extends Controller {
  async dashboard() {
    const { service } = this;
    const [ readinessPage, automationPage, prdGoalsPage, priorityPage ] = await Promise.all([
      service.fitnessAsset.queryView('v_analysis_release_readiness'),
      service.fitnessAsset.queryView('v_metric_automation_coverage'),
      service.fitnessAsset.queryView('v_metric_prd_goal_coverage'),
      service.fitnessAsset.queryView('v_metric_priority_distribution'),
    ]);
    this.ctx.body = {
      code: 0,
      message: 'ok',
      data: {
        readiness: readinessPage.list[0] || null,
        automation: automationPage.list,
        prdGoals: prdGoalsPage.list,
        priority: priorityPage.list,
      },
    };
  }

  async listItems() {
    const data = await this.service.fitnessAsset.listTestItems(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async exportItems() {
    const format = (this.ctx.query.format || 'json').toLowerCase();
    const data = await this.service.fitnessAsset.exportTestItems(this.ctx.query);
    if (format === 'csv') {
      this.ctx.set('Content-Type', 'text/csv; charset=utf-8');
      this.ctx.set('Content-Disposition', 'attachment; filename="fitness-items.csv"');
      this.ctx.body = data.csv;
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data: { list: data.list, total: data.total } };
  }

  async showItem() {
    const data = await this.service.fitnessAsset.getTestItem(this.ctx.params.itemId);
    if (!data) {
      this.ctx.status = 404;
      this.ctx.body = { code: 404, message: '测试项不存在', data: null };
      return;
    }
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async browse() {
    const data = await this.service.fitnessAsset.browseTree();
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async schemes() {
    const data = await this.service.fitnessAsset.listSchemes(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async listEnums() {
    const table = this.ctx.params.table;
    const data = await this.service.fitnessAsset.listEnum(table, this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async displayMeta() {
    const data = await this.service.fitnessAsset.getDisplayMeta(this.ctx.params.table);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async queryView() {
    const viewName = this.ctx.params.view;
    const data = await this.service.fitnessAsset.queryView(viewName, this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async listRisks() {
    const data = await this.service.fitnessAsset.listRiskItems(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }

  async listRiskLinks() {
    const data = await this.service.fitnessAsset.listRiskLinks(this.ctx.query);
    this.ctx.body = { code: 0, message: 'ok', data };
  }
}

module.exports = FitnessAssetController;
