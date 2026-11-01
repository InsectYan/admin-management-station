'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;

const MAX_PER_PACK = 8;
const MAX_TOTAL = 9;

function rootOf(app) {
  return path.join(app.baseDir, 'app', 'data', 'refmods');
}

function safeId(id) {
  const text = String(id || '');
  if (!/^[a-z0-9]+$/.test(text)) {
    const error = new Error('包不存在');
    error.status = 404;
    throw error;
  }
  return text;
}

function packKind(value) {
  return value === 'scene' ? 'scene' : 'character';
}

function decodeImage(file) {
  const payload = String(file?.data_base64 || '');
  const raw = payload.includes(',') ? payload.slice(payload.indexOf(',') + 1) : payload;
  const bytes = Buffer.from(raw, 'base64');
  if (!bytes.length) {
    const error = new Error('图片内容为空');
    error.status = 400;
    throw error;
  }
  const ext = String(file.filename || '').toLowerCase().match(/\.(png|jpe?g|webp)$/);
  return { bytes, ext: ext ? ext[0].replace('jpeg', 'jpg') : '.png' };
}

class RefmodService extends Service {
  root() {
    const dir = rootOf(this.app);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  readMeta(id) {
    const dir = path.join(this.root(), safeId(id));
    const file = path.join(dir, 'meta.json');
    if (!fs.existsSync(file)) {
      const error = new Error('包不存在');
      error.status = 404;
      throw error;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  async list() {
    const root = this.root();
    return fs.readdirSync(root)
      .filter(name => fs.existsSync(path.join(root, name, 'meta.json')))
      .map(name => {
        const meta = JSON.parse(fs.readFileSync(path.join(root, name, 'meta.json'), 'utf8'));
        return {
          id: meta.id,
          name: meta.name,
          kind: packKind(meta.kind),
          image_count: (meta.images || []).length,
          created_at: meta.created_at,
          cover: (meta.images || [])[0] || '',
        };
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  async create(payload) {
    const name = String(payload?.name || '').trim();
    const kind = packKind(payload?.kind);
    const images = Array.isArray(payload?.images) ? payload.images : [];
    const label = kind === 'scene' ? '场景' : '人物';
    if (!name) this.ctx.throw(400, `请填写${label}名称`);
    if (!images.length) this.ctx.throw(400, `请至少上传一张该${label}的图片`);
    if (images.length > MAX_PER_PACK) this.ctx.throw(400, `一个包最多 ${MAX_PER_PACK} 张图`);
    const id = Date.now().toString(36);
    const dir = path.join(this.root(), id);
    fs.mkdirSync(dir, { recursive: true });
    const saved = images.map((file, index) => {
      const image = decodeImage(file);
      const filename = `${index}${image.ext}`;
      fs.writeFileSync(path.join(dir, filename), image.bytes);
      return filename;
    });
    const meta = {
      id,
      name,
      kind,
      images: saved,
      created_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    return { id, name, kind, image_count: saved.length, created_at: meta.created_at, cover: saved[0] };
  }

  async remove(id) {
    const dir = path.join(this.root(), safeId(id));
    if (!fs.existsSync(path.join(dir, 'meta.json'))) this.ctx.throw(404, '包不存在');
    fs.rmSync(dir, { recursive: true, force: true });
    return { id };
  }

  filePath(id, filename) {
    const base = path.basename(String(filename || ''));
    if (!base || base !== filename) this.ctx.throw(400, '文件名无效');
    const meta = this.readMeta(id);
    if (!(meta.images || []).includes(base)) this.ctx.throw(404, '图片不存在');
    return path.join(this.root(), safeId(id), base);
  }

  async imageFiles(ids) {
    const files = [];
    for (const id of ids || []) {
      const meta = this.readMeta(id);
      for (const filename of meta.images || []) {
        const bytes = fs.readFileSync(path.join(this.root(), safeId(id), filename));
        files.push({
          filename,
          data_base64: bytes.toString('base64'),
          pack: meta.name,
        });
      }
    }
    if (!files.length) this.ctx.throw(400, '请选择至少一个包');
    if (files.length > MAX_TOTAL) {
      this.ctx.throw(400, `一次最多挂 ${MAX_TOTAL} 张参考图。人物和场景加起来超过时，每个包少放几张。`);
    }
    return files;
  }
}

module.exports = RefmodService;
