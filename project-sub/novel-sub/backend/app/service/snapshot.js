'use strict';

const Service = require('egg').Service;

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

class SnapshotService extends Service {
  present(row) {
    const payload = row.payload || {};
    return {
      id: row.id,
      label: row.label,
      created_at: row.created_at,
      chapter_count: Array.isArray(payload.bodies) ? payload.bodies.length : 0,
      plotline_count: Array.isArray(payload.plotlines) ? payload.plotlines.length : 0,
    };
  }

  async requireNovel(novelId) {
    const novel = await this.ctx.model.Novel.findByPk(novelId);
    if (!novel) this.ctx.throw(404, '小说不存在');
    return novel;
  }

  async capture(novel) {
    const [ bodies, plotlines, scripts, intents, dialogues, choices ] = await Promise.all([
      this.ctx.model.NovelChapterBody.findAll({ where: { novel_id: novel.id } }),
      this.ctx.model.Plotline.findAll({ where: { novel_id: novel.id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.StoryScript.findAll({ where: { novel_id: novel.id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.StoryIntentShot.findAll({ where: { novel_id: novel.id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.StoryDialogue.findAll({ where: { novel_id: novel.id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.StoryDialogueChoice.findAll({ where: { novel_id: novel.id }, order: [[ 'id', 'ASC' ]] }),
    ]);
    const scriptKeys = new Map(scripts.map((row, index) => [ row.id, index ]));
    const dialogueKeys = new Map(dialogues.map((row, index) => [ row.id, index ]));
    return {
      style_preset: novel.style_preset || null,
      setting_json: clone(novel.setting_json || {}),
      bodies: bodies.map(row => ({
        chapter_id: row.chapter_id,
        body: row.body || '',
        word_count: row.word_count || 0,
      })),
      plotlines: plotlines.map(row => ({
        name: row.name,
        kind: row.kind,
        status: row.status,
        summary: row.summary || '',
        plant_chapter_id: row.plant_chapter_id || '',
        payoff_chapter_id: row.payoff_chapter_id || '',
        events: clone(row.events || []),
      })),
      scripts: scripts.map((row, index) => ({
        key: index,
        title: row.title,
        variant: row.variant,
        chapter_ids: clone(row.chapter_ids || []),
        scenes: clone(row.scenes || []),
      })),
      intents: intents.map(row => ({
        script_key: scriptKeys.has(row.script_id) ? scriptKeys.get(row.script_id) : null,
        sort_order: row.sort_order,
        scene_order: row.scene_order,
        intent: row.intent || '',
        dialogue: row.dialogue || '',
        emotion: row.emotion || '',
        location: row.location || '',
        character_ids: clone(row.character_ids || []),
      })),
      dialogues: dialogues.map((row, index) => ({
        key: index,
        chapter_id: row.chapter_id,
        sort_order: row.sort_order,
        speaker: row.speaker,
        line: row.line,
      })),
      choices: choices.map(row => ({
        dialogue_key: dialogueKeys.get(row.dialogue_id),
        next_key: dialogueKeys.get(row.next_dialogue_id),
        label: row.label,
      })).filter(item => item.dialogue_key != null && item.next_key != null),
    };
  }

  async list(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StorySnapshot.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'DESC' ]],
    });
    return rows.map(row => this.present(row));
  }

  async create(novelId, body) {
    const novel = await this.requireNovel(novelId);
    const label = String(body.label || '').trim();
    if (!label) this.ctx.throw(400, '需要快照名称');
    if (label.length > 80) this.ctx.throw(400, '快照名称太长');
    const row = await this.ctx.model.StorySnapshot.create({
      novel_id: novel.id,
      label,
      payload: await this.capture(novel),
    });
    await this.ctx.service.collaboration.writeLog(novel.id, 'snapshot.create', { detail: { label } });
    return this.present(row);
  }

  async restore(novelId, snapshotId) {
    const novel = await this.requireNovel(novelId);
    const row = await this.ctx.model.StorySnapshot.findOne({
      where: { id: snapshotId, novel_id: novel.id },
    });
    if (!row) this.ctx.throw(404, '快照不存在');
    const locked = await this.ctx.model.StoryChapterLock.count({ where: { novel_id: novel.id } });
    if (locked) this.ctx.throw(400, '有章节还锁着，先解锁再回退');
    const payload = row.payload || {};
    await novel.update({
      setting_json: clone(payload.setting_json || {}),
      style_preset: payload.style_preset || null,
    });
    await this.ctx.model.NovelChapterBody.destroy({ where: { novel_id: novel.id } });
    for (const item of payload.bodies || []) {
      await this.ctx.model.NovelChapterBody.create({
        novel_id: novel.id,
        chapter_id: item.chapter_id,
        body: item.body || '',
        word_count: item.word_count || 0,
      });
    }
    await this.ctx.model.Plotline.destroy({ where: { novel_id: novel.id } });
    for (const item of payload.plotlines || []) {
      await this.ctx.model.Plotline.create({ novel_id: novel.id, ...item });
    }
    await this.ctx.model.StoryIntentShot.destroy({ where: { novel_id: novel.id } });
    await this.ctx.model.StoryScript.destroy({ where: { novel_id: novel.id } });
    const scriptIds = new Map();
    for (const item of payload.scripts || []) {
      const created = await this.ctx.model.StoryScript.create({
        novel_id: novel.id,
        title: item.title,
        variant: item.variant,
        chapter_ids: item.chapter_ids || [],
        scenes: item.scenes || [],
      });
      scriptIds.set(item.key, created.id);
    }
    for (const item of payload.intents || []) {
      await this.ctx.model.StoryIntentShot.create({
        novel_id: novel.id,
        script_id: item.script_key == null ? null : (scriptIds.get(item.script_key) || null),
        sort_order: item.sort_order || 1,
        scene_order: item.scene_order || 0,
        intent: item.intent || '',
        dialogue: item.dialogue || '',
        emotion: item.emotion || '',
        location: item.location || '',
        character_ids: item.character_ids || [],
      });
    }
    await this.ctx.model.StoryDialogueChoice.destroy({ where: { novel_id: novel.id } });
    await this.ctx.model.StoryDialogue.destroy({ where: { novel_id: novel.id } });
    const dialogueIds = new Map();
    for (const item of payload.dialogues || []) {
      const created = await this.ctx.model.StoryDialogue.create({
        novel_id: novel.id,
        chapter_id: item.chapter_id,
        sort_order: item.sort_order || 1,
        speaker: item.speaker,
        line: item.line,
      });
      if (item.key != null) dialogueIds.set(item.key, created.id);
    }
    for (const item of payload.choices || []) {
      const dialogueId = dialogueIds.get(item.dialogue_key);
      const nextId = dialogueIds.get(item.next_key);
      if (!dialogueId || !nextId) continue;
      await this.ctx.model.StoryDialogueChoice.create({
        novel_id: novel.id,
        dialogue_id: dialogueId,
        next_dialogue_id: nextId,
        label: item.label,
      });
    }
    await this.ctx.service.collaboration.writeLog(novel.id, 'snapshot.restore', {
      detail: { label: row.label },
    });
    return this.present(row);
  }
}

module.exports = SnapshotService;
