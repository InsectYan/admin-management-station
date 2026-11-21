'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { bins, run, probeFile, inspect } = require('../lib/mediaTools');

const AUDIO_EXT = new Set([ '.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac', '.wma' ]);
const EXTRACT_PREFIX = 'extract:';

function libraryRoot(app) {
  return path.resolve(app.config.voiceLibrary.dir);
}

function encodeId(rel) {
  return Buffer.from(rel, 'utf8').toString('base64url');
}

function decodeId(id) {
  try {
    return Buffer.from(String(id || ''), 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function insideRoot(root, rel) {
  const absolute = path.resolve(root, rel);
  const fromRoot = path.relative(root, absolute);
  if (!fromRoot || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return '';
  return absolute;
}

class VoiceLibraryService extends Service {
  root() {
    return libraryRoot(this.app);
  }

  async catalog() {
    const now = Date.now();
    const cached = this.app.voiceLibraryCatalog;
    if (cached && now - cached.at < 60000) return cached;
    const root = this.root();
    try {
      await fs.promises.access(root);
    } catch {
      this.ctx.throw(400, `音色库打不开：${root}`);
    }
    const rows = [];
    const skipped = [];
    await this.walk(root, root, rows, skipped);
    await this.walkExtract(rows);
    rows.sort((a, b) => a.folder.localeCompare(b.folder, 'zh') || a.name.localeCompare(b.name, 'zh'));
    const catalog = { at: now, rows, skipped };
    this.app.voiceLibraryCatalog = catalog;
    return catalog;
  }

  extractRoot() {
    return path.join(outputRoot(this.app), 'voice-library');
  }

  pushAudio(rows, { rel, source, folder }) {
    const ext = path.extname(rel).toLowerCase();
    if (!AUDIO_EXT.has(ext)) return;
    const token = source === 'extract' ? `${EXTRACT_PREFIX}${rel}` : rel;
    rows.push({
      id: encodeId(token),
      name: path.basename(rel, path.extname(rel)),
      folder,
      ext: ext.slice(1),
      rel,
      source,
      voice_key: `v${crypto.createHash('sha1').update(token).digest('hex').slice(0, 20)}`,
    });
  }

  async walk(root, dir, rows, skipped) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      const rel = path.relative(root, dir).split(path.sep).join('/');
      skipped.push(rel || dir);
      return;
    }
    for (const entry of entries) {
      if (rows.length >= 5000) return;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(root, absolute, rows, skipped);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(root, absolute).split(path.sep).join('/');
      if (!rel || rel.startsWith('..')) continue;
      const parts = rel.split('/');
      const folder = parts.length > 1 ? parts[parts.length - 2] : '未分组';
      this.pushAudio(rows, { rel, source: 'inject', folder });
    }
  }

  async walkExtract(rows) {
    const root = this.extractRoot();
    let entries;
    try {
      entries = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      this.pushAudio(rows, { rel: entry.name, source: 'extract', folder: '视频抽离' });
    }
  }

  present(item) {
    return {
      id: item.id,
      name: item.name,
      folder: item.folder,
      ext: item.ext,
      source: item.source || 'inject',
      voice_key: item.voice_key,
    };
  }

  async list(query) {
    const catalog = await this.catalog();
    const rows = catalog.rows;
    const folder = String(query.folder || '').trim();
    const keyword = String(query.q || '').trim();
    const source = [ 'inject', 'extract' ].includes(query.source) ? query.source : '';
    const matched = rows.filter(item => {
      if (source && item.source !== source) return false;
      if (folder && item.folder !== folder) return false;
      if (keyword && !item.name.includes(keyword)) return false;
      return true;
    });
    const folders = [ ...new Set(rows.map(item => item.folder)) ];
    return {
      folders,
      skipped: catalog.skipped,
      total: matched.length,
      rows: matched.map(item => this.present(item)),
    };
  }

  locate(token) {
    if (token.startsWith(EXTRACT_PREFIX)) {
      const name = path.basename(token.slice(EXTRACT_PREFIX.length));
      if (!name || name !== token.slice(EXTRACT_PREFIX.length)) return '';
      return resolveInside(outputRoot(this.app), path.join('voice-library', name)) || '';
    }
    return insideRoot(this.root(), token);
  }

  async requireVoice(id) {
    const token = decodeId(id);
    if (!token) this.ctx.throw(400, '音色不存在');
    const absolute = this.locate(token);
    if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '音色文件不在库里');
    const catalog = await this.catalog();
    const found = catalog.rows.find(item => item.id === id);
    if (!found) this.ctx.throw(404, '音色不存在');
    return { ...found, absolute };
  }

  decodeVideo(file) {
    const raw = String(file?.data || file?.data_base64 || '');
    const marker = ';base64,';
    const encoded = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw;
    const bytes = Buffer.from(encoded, 'base64');
    const original = path.basename(String(file?.filename || 'video.mp4'));
    const video = original.toLowerCase().match(/\.(mp4|webm|mov)$/);
    if (!video) this.ctx.throw(400, '请上传 mp4、webm 或 mov 视频');
    if (!bytes.length) this.ctx.throw(400, '视频是空的');
    if (bytes.length > 64 * 1024 * 1024) this.ctx.throw(400, '视频超过 64MB');
    return { bytes, ext: video[0], original };
  }

  voiceName(payload, original) {
    const fallback = path.basename(original, path.extname(original));
    const text = String(payload.name || fallback || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
    return text || `抽离${Date.now().toString(36)}`;
  }

  async extract(payload) {
    const media = this.decodeVideo(payload);
    const tools = await inspect(this.app);
    if (!tools.ffmpeg || !tools.ffprobe) this.ctx.throw(400, '本机没有 ffmpeg，抽不了音轨');
    const dir = this.extractRoot();
    await fs.promises.mkdir(dir, { recursive: true });
    const temp = path.join(os.tmpdir(), `cartoon-voice-${Date.now().toString(36)}${media.ext}`);
    await fs.promises.writeFile(temp, media.bytes);
    const base = this.voiceName(payload, media.original);
    let filename = `${base}.m4a`;
    for (let n = 2; fs.existsSync(path.join(dir, filename)) && n < 40; n += 1) filename = `${base}-${n}.m4a`;
    if (fs.existsSync(path.join(dir, filename))) filename = `${base}-${Date.now().toString(36)}.m4a`;
    const absolute = path.join(dir, filename);
    try {
      let probed;
      try {
        probed = await probeFile(this.app, temp);
      } catch (err) {
        this.ctx.throw(400, err.status === 400 ? err.message : '读不到这条视频');
      }
      if (!probed.hasAudio) this.ctx.throw(400, '这条视频没有音轨');
      const { ffmpeg } = bins(this.app);
      try {
        await run(ffmpeg, [ '-y', '-i', temp, '-vn', '-c:a', 'aac', '-b:a', '160k', absolute ]);
      } catch (err) {
        await fs.promises.rm(absolute, { force: true });
        const text = String(err.message || '');
        if (/matches no streams|does not contain any stream|Output file is empty/i.test(text)) {
          this.ctx.throw(400, '这条视频没有音轨');
        }
        throw err;
      }
    } finally {
      await fs.promises.rm(temp, { force: true });
    }
    this.app.voiceLibraryCatalog = null;
    const catalog = await this.catalog();
    const found = catalog.rows.find(item => item.source === 'extract' && item.rel === filename);
    return found ? this.present(found) : null;
  }
}

module.exports = VoiceLibraryService;
