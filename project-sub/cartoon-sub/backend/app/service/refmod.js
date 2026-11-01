'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');

const MAX_PER_PACK = 8;
const MAX_TOTAL = 9;

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
  async owned(projectId, id) {
    const row = await this.ctx.model.Refmod.findByPk(id);
    if (!row || String(row.project_id) !== String(projectId)) this.ctx.throw(404, '包不存在');
    return row;
  }

  present(row) {
    const images = JSON.parse(row.images || '[]');
    return {
      id: row.id,
      project_id: row.project_id,
      kind: packKind(row.kind),
      name: row.name,
      image_count: images.length,
      cover: images[0] || '',
      created_at: row.created_at,
    };
  }

  async list(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const rows = await this.ctx.model.Refmod.findAll({
      where: { project_id: projectId },
      order: [[ 'id', 'DESC' ]],
    });
    return rows.map(row => this.present(row));
  }

  async create(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const kind = packKind(payload?.kind);
    const name = String(payload?.name || '').trim();
    const images = Array.isArray(payload?.images) ? payload.images : [];
    const label = kind === 'scene' ? '场景' : '人物';
    if (!name) this.ctx.throw(400, `请填写${label}名称`);
    if (!images.length) this.ctx.throw(400, `请至少上传一张该${label}的图片`);
    if (images.length > MAX_PER_PACK) this.ctx.throw(400, `一个包最多 ${MAX_PER_PACK} 张图`);
    const row = await this.ctx.model.Refmod.create({
      project_id: Number(projectId),
      kind,
      name,
      images: '[]',
      created_at: new Date(),
    });
    const dir = path.join(outputRoot(this.app), 'refmods', String(projectId), String(row.id));
    fs.mkdirSync(dir, { recursive: true });
    const saved = images.map((file, index) => {
      const image = decodeImage(file);
      const filename = `${index}${image.ext}`;
      fs.writeFileSync(path.join(dir, filename), image.bytes);
      return filename;
    });
    await row.update({ images: JSON.stringify(saved) });
    return this.present(row);
  }

  async remove(projectId, id) {
    const row = await this.owned(projectId, id);
    const dir = path.join(outputRoot(this.app), 'refmods', String(projectId), String(row.id));
    fs.rmSync(dir, { recursive: true, force: true });
    await row.destroy();
    return { id: row.id };
  }

  filePath(projectId, id, filename) {
    const row = this.ctx.model.Refmod;
    return row.findByPk(id).then(found => {
      if (!found || String(found.project_id) !== String(projectId)) this.ctx.throw(404, '包不存在');
      const base = path.basename(String(filename || ''));
      const images = JSON.parse(found.images || '[]');
      if (!base || !images.includes(base)) this.ctx.throw(404, '图片不存在');
      const relative = path.join('refmods', String(projectId), String(found.id), base);
      const absolute = resolveInside(outputRoot(this.app), relative);
      if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '图片不存在');
      return absolute;
    });
  }

  async imageFiles(projectId, ids) {
    const files = [];
    for (const id of ids || []) {
      const row = await this.owned(projectId, id);
      const images = JSON.parse(row.images || '[]');
      for (const filename of images) {
        const relative = path.join('refmods', String(projectId), String(row.id), filename);
        const absolute = resolveInside(outputRoot(this.app), relative);
        if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(400, `包「${row.name}」缺了图片`);
        files.push({
          filename,
          data_base64: fs.readFileSync(absolute).toString('base64'),
          pack: row.name,
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
