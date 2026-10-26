'use strict';

const crypto = require('crypto');
const Service = require('egg').Service;

const PLATFORMS = [ 'wechat', 'douyin', 'bilibili', 'other' ];

function presentChannel(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    auth_status: row.auth_status,
    has_secret: Boolean(row.secret_hash),
    created_at: row.created_at,
  };
}

class PublishService extends Service {
  present(row) {
    return presentChannel(row);
  }

  async channels() {
    const rows = await this.ctx.model.OpsChannel.findAll({ order: [[ 'id', 'DESC' ]] });
    return rows.map(presentChannel);
  }

  async createChannel(body) {
    const name = String(body.name || '').trim();
    const platform = String(body.platform || '');
    if (!name) this.ctx.throw(400, '需要渠道名称');
    if (!PLATFORMS.includes(platform)) this.ctx.throw(400, '渠道不在可选范围内');
    const secret = String(body.secret || '');
    const row = await this.ctx.model.OpsChannel.create({
      name,
      platform,
      auth_status: secret ? 'authorized' : 'unauthorized',
      secret_hash: secret ? crypto.createHash('sha256').update(secret).digest('hex') : '',
    });
    return presentChannel(row);
  }

  async records() {
    const rows = await this.ctx.model.OpsPublishJob.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    return rows.map(row => row.toJSON());
  }

  async schedule(body) {
    const channel = await this.ctx.model.OpsChannel.findByPk(body.channel_id);
    if (!channel) this.ctx.throw(404, '渠道不存在');
    const sourceApp = String(body.source_app || '');
    const sourceId = String(body.source_id || '').trim();
    const version = body.version == null || body.version === '' ? null : Number(body.version);
    if (!sourceId) this.ctx.throw(400, '需要发布来源');
    if (sourceApp === 'video') {
      const listed = await this.ctx.service.content.cartoon('/api/library/exports');
      const rows = Array.isArray(listed) ? listed : [];
      const hit = rows.find(item => String(item.id) === sourceId && item.status === 'success');
      if (!hit) this.ctx.throw(400, '只能发布已经导出的成片');
    } else if (sourceApp === 'narrative') {
      const packageId = sourceId.startsWith('pkg_') ? sourceId : `pkg_${sourceId}`;
      if (!version) this.ctx.throw(400, '需要故事包版本');
      try {
        await this.ctx.service.content.novel(`/api/packages/${packageId}?version=${version}`);
      } catch (err) {
        this.ctx.throw(400, '只能发布已经发布的故事包');
      }
    } else {
      this.ctx.throw(400, '来源不在可选范围内');
    }
    const when = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (!when || Number.isNaN(when.getTime())) this.ctx.throw(400, '需要排期时间');
    const row = await this.ctx.model.OpsPublishJob.create({
      channel_id: channel.id,
      source_app: sourceApp,
      source_id: sourceId,
      version,
      scheduled_at: when,
      status: 'scheduled',
      reason: '',
    });
    return row.toJSON();
  }

  async result(id, body) {
    const row = await this.ctx.model.OpsPublishJob.findByPk(id);
    if (!row) this.ctx.throw(404, '发布记录不存在');
    const status = String(body.status || '');
    if (status !== 'success' && status !== 'failed') this.ctx.throw(400, '发布结果只能是成功或失败');
    const reason = String(body.reason || '').trim();
    if (status === 'failed' && !reason) this.ctx.throw(400, '失败需要填写原因');
    const counts = this.counts(body, status, row.status);
    row.status = status;
    row.reason = reason;
    if (counts) {
      row.play_count = counts.play_count;
      row.finish_count = counts.finish_count;
      row.conversion_count = counts.conversion_count;
    }
    await row.save();
    return row.toJSON();
  }

  counts(body, status, current) {
    const keys = [ 'play_count', 'finish_count', 'conversion_count' ];
    const present = keys.some(key => body[key] != null && body[key] !== '');
    if (!present) return null;
    if (status !== 'success' || current !== 'success') this.ctx.throw(400, '只有发布成功才能记播放');
    const counts = {};
    for (const key of keys) {
      const raw = body[key];
      const value = raw == null || raw === '' ? 0 : Number(raw);
      if (!Number.isInteger(value) || value < 0) this.ctx.throw(400, '播放数据需要是非负整数');
      counts[key] = value;
    }
    return counts;
  }

  async takedown(id, body) {
    const row = await this.ctx.model.OpsPublishJob.findByPk(id);
    if (!row) this.ctx.throw(404, '发布记录不存在');
    const reason = String(body.reason || '').trim();
    if (!reason) this.ctx.throw(400, '下架需要填写原因');
    row.status = 'taken_down';
    row.reason = reason;
    await row.save();
    return row.toJSON();
  }
}

module.exports = PublishService;
