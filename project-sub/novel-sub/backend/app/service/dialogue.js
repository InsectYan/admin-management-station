'use strict';

const Service = require('egg').Service;

class DialogueService extends Service {
  async requireGame(novelId) {
    const novel = await this.ctx.model.Novel.findByPk(novelId);
    if (!novel) this.ctx.throw(404, '小说不存在');
    if (novel.project_kind !== 'game_plot') this.ctx.throw(400, '这个类型不用任务对话');
    return novel;
  }

  async requireChapter(novel, chapterId) {
    const chapters = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    if (!chapters.some(item => item.id === String(chapterId))) this.ctx.throw(404, '章节不存在');
  }

  present(row) {
    return {
      id: row.id,
      chapter_id: row.chapter_id,
      sort_order: row.sort_order,
      speaker: row.speaker,
      line: row.line,
    };
  }

  async list(novelId, query) {
    const novel = await this.requireGame(novelId);
    const where = { novel_id: novel.id };
    if (query.chapter_id) {
      await this.requireChapter(novel, query.chapter_id);
      where.chapter_id = String(query.chapter_id);
    }
    const rows = await this.ctx.model.StoryDialogue.findAll({
      where,
      order: [[ 'chapter_id', 'ASC' ], [ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const choices = rows.length
      ? await this.ctx.model.StoryDialogueChoice.findAll({
        where: { dialogue_id: rows.map(row => row.id) },
        order: [[ 'id', 'ASC' ]],
      })
      : [];
    const nextId = new Map();
    for (let index = 0; index < rows.length; index += 1) {
      const current = rows[index];
      const upcoming = rows[index + 1];
      if (upcoming && upcoming.chapter_id === current.chapter_id) nextId.set(current.id, upcoming.id);
    }
    return rows.map(row => {
      const mine = choices.filter(item => item.dialogue_id === row.id);
      return {
        ...this.present(row),
        follows_id: mine.length ? null : (nextId.get(row.id) || null),
        choices: mine.map(item => ({
          id: item.id,
          label: item.label,
          next_dialogue_id: item.next_dialogue_id,
        })),
      };
    });
  }

  async addChoice(novelId, dialogueId, body) {
    const novel = await this.requireGame(novelId);
    const line = await this.ctx.model.StoryDialogue.findOne({
      where: { id: dialogueId, novel_id: novel.id },
    });
    if (!line) this.ctx.throw(404, '对话不存在');
    const label = String(body.label || '').trim();
    if (!label) this.ctx.throw(400, '需要选项');
    const next = await this.ctx.model.StoryDialogue.findOne({
      where: { id: body.next_dialogue_id, novel_id: novel.id },
    });
    if (!next) this.ctx.throw(404, '目标台词不存在');
    if (String(next.chapter_id) !== String(line.chapter_id)) this.ctx.throw(400, '分支要留在同一任务');
    if (next.id === line.id) this.ctx.throw(400, '分支不能指向自己');
    const row = await this.ctx.model.StoryDialogueChoice.create({
      novel_id: novel.id,
      dialogue_id: line.id,
      next_dialogue_id: next.id,
      label: label.slice(0, 120),
    });
    return { id: row.id, label: row.label, next_dialogue_id: row.next_dialogue_id };
  }

  async removeChoice(novelId, dialogueId, choiceId) {
    const novel = await this.requireGame(novelId);
    const row = await this.ctx.model.StoryDialogueChoice.findOne({
      where: { id: choiceId, dialogue_id: dialogueId, novel_id: novel.id },
    });
    if (!row) this.ctx.throw(404, '选项不存在');
    await row.destroy();
    return { id: Number(choiceId) };
  }

  async create(novelId, body) {
    const novel = await this.requireGame(novelId);
    const chapterId = String(body.chapter_id || '').trim();
    const speaker = String(body.speaker || '').trim();
    const line = String(body.line || '').trim();
    if (!chapterId) this.ctx.throw(400, '需要任务');
    await this.requireChapter(novel, chapterId);
    if (!speaker) this.ctx.throw(400, '需要说话人');
    if (!line) this.ctx.throw(400, '需要台词');
    const last = await this.ctx.model.StoryDialogue.max('sort_order', {
      where: { novel_id: novel.id, chapter_id: chapterId },
    });
    const row = await this.ctx.model.StoryDialogue.create({
      novel_id: novel.id,
      chapter_id: chapterId,
      sort_order: Number(last) ? Number(last) + 1 : 1,
      speaker,
      line,
    });
    return this.present(row);
  }

  async update(novelId, dialogueId, body) {
    const novel = await this.requireGame(novelId);
    const row = await this.ctx.model.StoryDialogue.findOne({
      where: { id: dialogueId, novel_id: novel.id },
    });
    if (!row) this.ctx.throw(404, '对话不存在');
    const speaker = body.speaker == null ? row.speaker : String(body.speaker).trim();
    const line = body.line == null ? row.line : String(body.line).trim();
    if (!speaker) this.ctx.throw(400, '需要说话人');
    if (!line) this.ctx.throw(400, '需要台词');
    await row.update({ speaker, line });
    return this.present(row);
  }

  async remove(novelId, dialogueId) {
    const novel = await this.requireGame(novelId);
    const row = await this.ctx.model.StoryDialogue.findOne({
      where: { id: dialogueId, novel_id: novel.id },
    });
    if (!row) this.ctx.throw(404, '对话不存在');
    await row.destroy();
    return { id: Number(dialogueId) };
  }
}

module.exports = DialogueService;
