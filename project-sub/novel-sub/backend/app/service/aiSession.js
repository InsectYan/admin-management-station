'use strict';

const { withFormattedTimes } = require('../lib/formatDateTime');

function parseNovelId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

class AiSessionService extends require('egg').Service {
  async list({ novel_id, feature_key } = {}) {
    const { Op } = this.app.Sequelize;
    const where = { status: { [Op.ne]: 'archived' } };
    const novelId = parseNovelId(novel_id);
    if (novelId) where.novel_id = novelId;
    else where.novel_id = null;
    if (feature_key) where.feature_key = String(feature_key);

    const rows = await this.ctx.model.NovelAiSession.findAll({
      where,
      order: [['updated_at', 'DESC']],
    });
    return rows.map(withFormattedTimes);
  }

  async get(id) {
    const session = await this.ctx.model.NovelAiSession.findByPk(id);
    if (!session) this.ctx.throw(404, '会话不存在');
    return session;
  }

  toPublic(session) {
    return withFormattedTimes(session);
  }

  async create(body = {}) {
    const feature_key = String(body.feature_key || '').trim();
    if (!feature_key) this.ctx.throw(400, '缺少 feature_key');
    const novelId = parseNovelId(body.novel_id);
    const row = await this.ctx.model.NovelAiSession.create({
      novel_id: novelId,
      feature_key,
      title: body.title || `${feature_key} 会话`,
      status: 'active',
      bound_context_json: body.bound_context_json || {},
    });
    return withFormattedTimes(row);
  }

  async update(id, body = {}) {
    const session = await this.get(id);
    const patch = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.status !== undefined) patch.status = body.status;
    if (body.bound_context_json !== undefined) patch.bound_context_json = body.bound_context_json;
    if (body.novel_id !== undefined) patch.novel_id = parseNovelId(body.novel_id);
    await session.update(patch);
    return withFormattedTimes(session);
  }

  async destroy(id) {
    const session = await this.get(id);
    await this.app.model.transaction(async (t) => {
      await this.ctx.model.NovelAiMessage.destroy({
        where: { session_id: session.id },
        transaction: t,
      });
      await session.destroy({ transaction: t });
    });
    return true;
  }

  async listMessages(sessionId) {
    await this.get(sessionId);
    const rows = await this.ctx.model.NovelAiMessage.findAll({
      where: { session_id: sessionId },
      order: [['created_at', 'ASC'], ['id', 'ASC']],
    });
    return rows.map(withFormattedTimes);
  }

  async addMessage(sessionId, attrs) {
    await this.get(sessionId);
    const row = await this.ctx.model.NovelAiMessage.create({
      session_id: sessionId,
      role: attrs.role,
      content: attrs.content || '',
      target_fields_json: attrs.target_fields_json || [],
      patch_json: attrs.patch_json || {},
      applied: Boolean(attrs.applied),
      trace_id: attrs.trace_id || null,
      scene: attrs.scene || null,
    });
    await this.ctx.model.NovelAiSession.update(
      { updated_at: new Date() },
      { where: { id: sessionId } },
    );
    return row;
  }

  async applyMessage(sessionId, messageId, paths) {
    await this.get(sessionId);
    const message = await this.ctx.model.NovelAiMessage.findOne({
      where: { id: messageId, session_id: sessionId },
    });
    if (!message) this.ctx.throw(404, '消息不存在');
    if (message.role !== 'assistant') this.ctx.throw(400, '只能采纳助手消息');
    await message.update({ applied: true });
    return { message: withFormattedTimes(message), paths: Array.isArray(paths) ? paths : [] };
  }
}

module.exports = AiSessionService;
