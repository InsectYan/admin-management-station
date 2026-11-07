'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;

const AUDIO_EXT = new Set([ '.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac', '.wma' ]);

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
    rows.sort((a, b) => a.folder.localeCompare(b.folder, 'zh') || a.name.localeCompare(b.name, 'zh'));
    const catalog = { at: now, rows, skipped };
    this.app.voiceLibraryCatalog = catalog;
    return catalog;
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
      const ext = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXT.has(ext)) continue;
      const rel = path.relative(root, absolute).split(path.sep).join('/');
      if (!rel || rel.startsWith('..')) continue;
      const parts = rel.split('/');
      const folder = parts.length > 1 ? parts[parts.length - 2] : '未分组';
      rows.push({
        id: encodeId(rel),
        name: path.basename(entry.name, path.extname(entry.name)),
        folder,
        ext: ext.slice(1),
        rel,
        voice_key: `v${crypto.createHash('sha1').update(rel).digest('hex').slice(0, 20)}`,
      });
    }
  }

  async list(query) {
    const catalog = await this.catalog();
    const rows = catalog.rows;
    const folder = String(query.folder || '').trim();
    const keyword = String(query.q || '').trim();
    const matched = rows.filter(item => {
      if (folder && item.folder !== folder) return false;
      if (keyword && !item.name.includes(keyword)) return false;
      return true;
    });
    const folders = [ ...new Set(rows.map(item => item.folder)) ];
    return {
      folders,
      skipped: catalog.skipped,
      total: matched.length,
      rows: matched.map(item => ({
        id: item.id,
        name: item.name,
        folder: item.folder,
        ext: item.ext,
        voice_key: item.voice_key,
      })),
    };
  }

  async requireVoice(id) {
    const rel = decodeId(id);
    if (!rel) this.ctx.throw(400, '音色不存在');
    const root = this.root();
    const absolute = insideRoot(root, rel);
    if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '音色文件不在库里');
    const catalog = await this.catalog();
    const found = catalog.rows.find(item => item.id === id) || catalog.rows.find(item => item.rel === rel);
    if (!found) this.ctx.throw(404, '音色不存在');
    return { ...found, absolute };
  }
}

module.exports = VoiceLibraryService;
