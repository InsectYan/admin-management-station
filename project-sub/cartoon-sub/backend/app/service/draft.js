'use strict';

const Service = require('egg').Service;
const { invokeSkill } = require('../lib/agentProxy');
const { SHOT_SIZES, CAMERA_MOVES } = require('../lib/cartoonMeta');

function outputOf(result) {
  return result?.output || {};
}

class DraftService extends Service {
  async run(projectId, importId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const chapter = await this.ctx.model.Import.findByPk(importId);
    if (!chapter || String(chapter.project_id) !== String(projectId)) this.ctx.throw(404, '章节快照不存在');

    const scriptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-script-skill',
      action: 'draft',
      payload: {
        chapter_title: chapter.chapter_title || '',
        body: chapter.body,
        visual_style: project.visual_style || '',
      },
    });
    const scriptData = outputOf(scriptResult).script_data;
    if (!scriptData || !Array.isArray(scriptData.scenes) || !scriptData.scenes.length) {
      this.ctx.throw(502, '剧本没有返回场次');
    }
    await chapter.update({
      script_data: scriptData,
      characters: scriptData.characters || [],
    });

    const boardResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-storyboard-skill',
      action: 'draft',
      payload: { script_data: scriptData, body: chapter.body },
    });
    const shots = outputOf(boardResult).shots;
    if (!Array.isArray(shots) || !shots.length) this.ctx.throw(502, '分镜没有返回镜头');

    const promptResult = await invokeSkill(this.ctx, {
      skill: 'cartoon-prompt-skill',
      action: 'draft',
      payload: { shots, visual_style: project.visual_style || '' },
    });
    const prompts = outputOf(promptResult).prompts || [];

    const previous = await this.ctx.model.Shot.findAll({ where: { import_id: chapter.id } });
    if (previous.length) {
      await this.ctx.model.Shot.destroy({ where: { id: previous.map(item => item.id) } });
    }
    const max = await this.ctx.model.Shot.max('sort_order', { where: { project_id: project.id } });
    let order = Number.isFinite(max) ? max + 1 : 0;
    for (let index = 0; index < shots.length; index += 1) {
      const item = shots[index];
      const shot = await this.ctx.model.Shot.create({
        project_id: project.id,
        import_id: chapter.id,
        sort_order: order,
        shot_size: SHOT_SIZES.includes(item.shot_size) ? item.shot_size : '中景',
        camera_move: CAMERA_MOVES.includes(item.camera_move) ? item.camera_move : '固定',
        description: item.description,
      });
      order += 1;
      const prompt = prompts.find(row => row.index === index) || prompts[index] || {};
      await this.ctx.model.Prompt.create({
        shot_id: shot.id,
        positive_zh: prompt.positive_zh || item.description,
        negative_zh: prompt.negative_zh || '',
      });
    }
    return this.ctx.service.project.show(project.id);
  }
}

module.exports = DraftService;
