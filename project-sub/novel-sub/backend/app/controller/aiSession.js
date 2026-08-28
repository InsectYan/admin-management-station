'use strict';

const Controller = require('egg').Controller;

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}

function fail(ctx, err) {
  const status = err.status || 500;
  ctx.status = status;
  ctx.body = {
    code: status,
    message: err.message || '服务器错误',
    error_code: err.code || undefined,
  };
}

class AiSessionController extends Controller {
  async index() {
    try {
      const { novel_id, feature_key } = this.ctx.query;
      if (!feature_key) {
        const err = new Error('缺少 feature_key');
        err.status = 400;
        throw err;
      }
      const rows = await this.ctx.service.aiSession.list({ novel_id, feature_key });
      ok(this.ctx, rows);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    try {
      const row = await this.ctx.service.aiSession.create(this.ctx.request.body || {});
      ok(this.ctx, row);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      const row = await this.ctx.service.aiSession.update(this.ctx.params.id, this.ctx.request.body || {});
      ok(this.ctx, row);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async messages() {
    try {
      const rows = await this.ctx.service.aiSession.listMessages(this.ctx.params.id);
      ok(this.ctx, rows);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async turns() {
    try {
      const data = await this.ctx.service.aiTurn.run(this.ctx.params.id, this.ctx.request.body || {});
      ok(this.ctx, data);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async turnsStream() {
    const { ctx } = this;
    ctx.status = 200;
    ctx.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    ctx.respond = false;
    const res = ctx.res;
    try {
      res.flushHeaders?.();
    } catch {
      /* ignore */
    }

    const emit = (event, data) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        /* client closed */
      }
    };

    try {
      await ctx.service.aiTurn.runStream(ctx.params.id, ctx.request.body || {}, emit);
    } catch (err) {
      emit('error', {
        message: err.message || '生成失败',
        code: err.code || err.status || 500,
      });
    } finally {
      try { res.end(); } catch { /* ignore */ }
    }
  }

  async apply() {
    try {
      const { message_id, paths } = this.ctx.request.body || {};
      if (!message_id) {
        const err = new Error('缺少 message_id');
        err.status = 400;
        throw err;
      }
      const data = await this.ctx.service.aiSession.applyMessage(this.ctx.params.id, message_id, paths);
      ok(this.ctx, data);
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = AiSessionController;
