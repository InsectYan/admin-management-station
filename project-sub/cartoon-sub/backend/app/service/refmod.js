'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');

const MAX_PER_PACK = 8;
const MAX_TOTAL = 9;

const VISUAL_KINDS = new Set([ 'character', 'scene', 'prop' ]);
const KIND_LABEL = { character: '人物', scene: '场景', prop: '道具' };

function packKind(value) {
  if (value === 'scene' || value === 'prop') return value;
  return 'character';
}

function assetBrief(asset) {
  const bits = [];
  const push = value => {
    const text = String(value || '').trim();
    if (text) bits.push(text);
  };
  push(asset.description);
  if (asset.kind === 'character') {
    push(asset.consistency_note);
    if (String(asset.costume_note || '').trim()) bits.push(`服装：${String(asset.costume_note).trim()}`);
    if (String(asset.expression_note || '').trim()) bits.push(`表情：${String(asset.expression_note).trim()}`);
  }
  if (asset.kind === 'scene') push(asset.scene_type);
  if (asset.kind === 'prop') push(asset.prop_category);
  return bits.join('。');
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
      asset_id: row.asset_id || null,
      kind: packKind(row.kind),
      name: row.name,
      image_count: images.length,
      cover: images[0] || '',
      images,
      created_at: row.created_at,
    };
  }

  async list(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const [ rows, assets ] = await Promise.all([
      this.ctx.model.Refmod.findAll({
        where: { project_id: projectId },
        order: [[ 'id', 'DESC' ]],
      }),
      this.ctx.model.Asset.findAll({ where: { project_id: projectId } }),
    ]);
    const byId = new Map(assets.map(row => [ row.id, row ]));
    return rows.map(row => {
      const asset = byId.get(row.asset_id);
      return {
        ...this.present(row),
        asset_name: asset?.name || '',
        asset_kind: asset?.kind || '',
      };
    });
  }

  async composePrompt(projectId, assetIds, shotPrompt, pictures) {
    const ids = [ ...new Set((assetIds || []).map(id => Number(id)).filter(id => id > 0)) ];
    const assets = ids.length
      ? await this.ctx.model.Asset.findAll({ where: { project_id: projectId, id: ids } })
      : [];
    const byId = new Map(assets.map(row => [ row.id, row ]));
    const ordered = ids
      .map(id => byId.get(id))
      .filter(row => row && !row.disabled && VISUAL_KINDS.has(row.kind));
    const packs = ordered.length
      ? await this.ctx.model.Refmod.findAll({
        where: { project_id: projectId, asset_id: ordered.map(row => row.id) },
      })
      : [];
    const packByAsset = new Map(packs.map(row => [ row.asset_id, row ]));
    const lines = [];
    const refmodIds = [];
    let cursor = 1;
    ordered.forEach(asset => {
      const pack = packByAsset.get(asset.id);
      const count = pack ? JSON.parse(pack.images || '[]').length : 0;
      const tags = [];
      if (pictures && count) {
        for (let index = 0; index < count; index += 1) tags.push(`<Picture ${cursor + index}>`);
        cursor += count;
        refmodIds.push(pack.id);
      }
      const brief = assetBrief(asset);
      const label = KIND_LABEL[asset.kind] || '资产';
      const head = tags.length ? `${tags.join(' ')} 是${label}「${asset.name}」` : `${label}「${asset.name}」`;
      lines.push(brief ? `${head}。${brief}` : head);
    });
    const shot = String(shotPrompt || '').trim();
    const positive = lines.length
      ? [ lines.join('\n'), shot ? `镜头：${shot}` : '' ].filter(Boolean).join('\n')
      : shot;
    return { positive, refmodIds };
  }

  async create(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const assetId = Number(payload?.asset_id);
    if (!assetId) this.ctx.throw(400, '请先选中已保存的角色、场景或道具');
    const asset = await this.ctx.model.Asset.findByPk(assetId);
    if (!asset || String(asset.project_id) !== String(projectId)) this.ctx.throw(404, '资产不存在');
    if (!VISUAL_KINDS.has(asset.kind)) this.ctx.throw(400, '只有角色、场景和道具可以绑 RefMod');
    if (asset.disabled) this.ctx.throw(400, '停用的资产不能绑 RefMod');
    const taken = await this.ctx.model.Refmod.findOne({ where: { project_id: projectId, asset_id: asset.id } });
    if (taken) this.ctx.throw(400, '这个资产已经有 RefMod，先删除再新增');
    const images = Array.isArray(payload?.images) ? payload.images : [];
    const label = KIND_LABEL[asset.kind] || '资产';
    if (!images.length) this.ctx.throw(400, `请至少上传一张该${label}的图片`);
    if (images.length > MAX_PER_PACK) this.ctx.throw(400, `一个包最多 ${MAX_PER_PACK} 张图`);
    const row = await this.ctx.model.Refmod.create({
      project_id: Number(projectId),
      asset_id: asset.id,
      kind: packKind(asset.kind),
      name: asset.name,
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
    return { ...this.present(row), asset_name: asset.name, asset_kind: asset.kind };
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
