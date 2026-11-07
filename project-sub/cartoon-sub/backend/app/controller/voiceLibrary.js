'use strict';

const fs = require('fs');
const path = require('path');
const Controller = require('egg').Controller;

const AUDIO_TYPE = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
};

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class VoiceLibraryController extends Controller {
  async index() {
    try {
      ok(this.ctx, await this.ctx.service.voiceLibrary.list(this.ctx.query || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async file() {
    try {
      const voice = await this.ctx.service.voiceLibrary.requireVoice(this.ctx.query.id);
      const stat = fs.statSync(voice.absolute);
      const ext = path.extname(voice.absolute).toLowerCase();
      this.ctx.set('Accept-Ranges', 'bytes');
      this.ctx.set('Content-Type', AUDIO_TYPE[ext] || 'application/octet-stream');
      const range = this.ctx.get('range');
      if (!range) {
        this.ctx.set('Content-Length', String(stat.size));
        this.ctx.body = fs.createReadStream(voice.absolute);
        return;
      }
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (!match || stat.size <= 0) {
        this.ctx.status = 416;
        this.ctx.set('Content-Range', `bytes */${stat.size}`);
        this.ctx.body = '';
        return;
      }
      let start = match[1] === '' ? 0 : Number(match[1]);
      let end = match[2] === '' ? stat.size - 1 : Number(match[2]);
      if (match[1] === '' && match[2] !== '') {
        const suffix = Number(match[2]);
        start = Math.max(0, stat.size - suffix);
        end = stat.size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
        this.ctx.status = 416;
        this.ctx.set('Content-Range', `bytes */${stat.size}`);
        this.ctx.body = '';
        return;
      }
      end = Math.min(end, stat.size - 1);
      this.ctx.status = 206;
      this.ctx.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      this.ctx.set('Content-Length', String(end - start + 1));
      this.ctx.body = fs.createReadStream(voice.absolute, { start, end });
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = VoiceLibraryController;
