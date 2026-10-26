'use strict';

const Service = require('egg').Service;
const { reportAudit } = require('../lib/reportAudit');

const NODES = [ 'input', 'script', 'storyboard', 'assets', 'generate', 'voice', 'subtitle', 'compose', 'preview', 'review' ];

class ReviewService extends Service {
  async list(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    return this.ctx.model.Review.findAll({
      where: { project_id: project.id },
      order: [[ 'id', 'DESC' ]],
    });
  }

  async decide(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const decision = payload.decision;
    if (![ 'pass', 'reject' ].includes(decision)) this.ctx.throw(400, '需要通过或驳回');
    const note = String(payload.note || '').trim();
    const issues = String(payload.issues || '').trim().slice(0, 500);
    const episode = await this.ctx.service.project.ensureEpisode(project.id);
    let node = 'export';
    if (decision === 'reject') {
      if (!note) this.ctx.throw(400, '驳回需要填写原因');
      if (!NODES.includes(payload.node)) this.ctx.throw(400, '需要回到的节点');
      node = payload.node;
      await episode.update({ current_node: node, status: 'rejected' });
    } else {
      await episode.update({ current_node: 'export', status: 'passed' });
    }
    const review = await this.ctx.model.Review.create({
      project_id: project.id,
      video_task_id: episode.id,
      decision,
      node,
      note,
      issues,
    });
    await reportAudit(this.ctx, {
      action: decision === 'pass' ? 'video.review.pass' : 'video.review.reject',
      external_id: project.id,
      detail: { project_id: project.id, node, decision },
    });
    return { review, episode };
  }
}

module.exports = ReviewService;
