'use strict';

const Service = require('egg').Service;

const ROLES = [ 'author', 'editor', 'reviewer' ];

class CollaborationService extends Service {
  actor() {
    return String(this.ctx.state.user?.username || 'local');
  }

  holderOf(body) {
    const name = String(body?.holder || this.actor()).trim();
    return name || 'local';
  }

  async requireNovel(novelId) {
    const row = await this.ctx.model.Novel.findByPk(novelId);
    if (!row) this.ctx.throw(404, '小说不存在');
    return row;
  }

  async requireChapter(novel, chapterId) {
    const chapters = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    const current = chapters.find(item => item.id === String(chapterId));
    if (!current) this.ctx.throw(404, '章节不存在');
    return current;
  }

  async writeLog(novelId, action, extra = {}) {
    await this.ctx.model.StoryActivity.create({
      novel_id: novelId,
      actor: extra.actor || this.actor(),
      action,
      chapter_id: extra.chapter_id || '',
      detail: extra.detail || {},
    });
  }

  async members(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StoryMember.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(row => row.toJSON());
  }

  async addMember(novelId, body) {
    await this.requireNovel(novelId);
    const username = String(body.username || '').trim();
    const role = String(body.role || '');
    if (!username) this.ctx.throw(400, '需要成员账号');
    if (!ROLES.includes(role)) this.ctx.throw(400, '角色不在可选范围内');
    const exists = await this.ctx.model.StoryMember.findOne({ where: { novel_id: novelId, username } });
    if (exists) this.ctx.throw(400, '这个成员已经在项目里');
    const row = await this.ctx.model.StoryMember.create({ novel_id: novelId, username, role });
    await this.writeLog(novelId, 'member.add', { actor: username, detail: { role } });
    return row.toJSON();
  }

  async removeMember(novelId, memberId) {
    await this.requireNovel(novelId);
    const row = await this.ctx.model.StoryMember.findOne({ where: { id: memberId, novel_id: novelId } });
    if (!row) this.ctx.throw(404, '成员不存在');
    const holding = await this.ctx.model.StoryChapterLock.count({
      where: { novel_id: novelId, holder: row.username },
    });
    if (holding) this.ctx.throw(400, '这个成员还锁着章节');
    const username = row.username;
    await row.destroy();
    await this.writeLog(novelId, 'member.remove', { actor: username, detail: {} });
    return { id: Number(memberId) };
  }

  async locks(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StoryChapterLock.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(row => ({
      chapter_id: row.chapter_id,
      holder: row.holder,
      locked_at: row.updated_at,
    }));
  }

  async lockChapter(novelId, chapterId, body) {
    const novel = await this.requireNovel(novelId);
    await this.requireChapter(novel, chapterId);
    const holder = this.holderOf(body);
    const members = await this.ctx.model.StoryMember.findAll({ where: { novel_id: novelId } });
    if (members.length && !members.some(item => item.username === holder)) {
      this.ctx.throw(400, '只有项目成员能锁章');
    }
    const existing = await this.ctx.model.StoryChapterLock.findOne({
      where: { novel_id: novelId, chapter_id: String(chapterId) },
    });
    if (existing && existing.holder !== holder) this.ctx.throw(400, '这一章已锁定');
    if (existing) return { chapter_id: existing.chapter_id, holder: existing.holder, locked: true };
    const row = await this.ctx.model.StoryChapterLock.create({
      novel_id: novelId,
      chapter_id: String(chapterId),
      holder,
    });
    await this.writeLog(novelId, 'chapter.lock', { actor: holder, chapter_id: String(chapterId), detail: {} });
    return { chapter_id: row.chapter_id, holder: row.holder, locked: true };
  }

  async unlockChapter(novelId, chapterId, body) {
    await this.requireNovel(novelId);
    const holder = this.holderOf(body);
    const existing = await this.ctx.model.StoryChapterLock.findOne({
      where: { novel_id: novelId, chapter_id: String(chapterId) },
    });
    if (!existing) return { chapter_id: String(chapterId), locked: false };
    const members = await this.ctx.model.StoryMember.findAll({ where: { novel_id: novelId } });
    const self = members.find(item => item.username === holder);
    const allowed = holder === existing.holder || self?.role === 'author';
    if (!allowed) this.ctx.throw(400, '只有锁定人或作者能解锁');
    await existing.destroy();
    await this.writeLog(novelId, 'chapter.unlock', { actor: holder, chapter_id: String(chapterId), detail: {} });
    return { chapter_id: String(chapterId), locked: false };
  }

  async assertCanWrite(novelId, chapterId, holder) {
    const existing = await this.ctx.model.StoryChapterLock.findOne({
      where: { novel_id: novelId, chapter_id: String(chapterId) },
    });
    if (!existing) return;
    const who = String(holder || this.actor()).trim() || 'local';
    if (existing.holder !== who) this.ctx.throw(400, '这一章已锁定');
  }

  async activity(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StoryActivity.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'DESC' ]],
      limit: 50,
    });
    return rows.map(row => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      chapter_id: row.chapter_id,
      detail: row.detail || {},
      created_at: row.created_at,
    }));
  }
}

module.exports = CollaborationService;
