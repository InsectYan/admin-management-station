'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const { mentionedAssetIds, shotText } = require('../lib/shotAssets');

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

function noteText(value) {
  return String(value || '').trim().slice(0, 80);
}

function parseJson(raw, fallback) {
  try {
    const data = JSON.parse(raw || '');
    return data == null ? fallback : data;
  } catch {
    return fallback;
  }
}

function fileNames(raw) {
  return parseJson(raw, []).map(item => (typeof item === 'string' ? item : item?.file || item?.name || '')).filter(Boolean);
}

function noteMap(raw) {
  const data = parseJson(raw, {});
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function chosenNames(names, assetId, picks) {
  if (!picks || typeof picks !== 'object') return names;
  const list = picks[assetId] ?? picks[String(assetId)];
  if (!Array.isArray(list)) return names;
  const allow = new Set(list.map(name => path.basename(String(name || ''))).filter(Boolean));
  return names.filter(name => allow.has(name));
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
    const images = fileNames(row.images);
    const notes = noteMap(row.image_notes);
    return {
      id: row.id,
      project_id: row.project_id,
      asset_id: row.asset_id || null,
      kind: packKind(row.kind),
      name: row.name,
      image_count: images.length,
      cover: images[0] || '',
      images,
      notes,
      items: images.map(name => ({ name, note: noteText(notes[name]) })),
      created_at: row.created_at,
    };
  }

  normalizePicks(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    Object.entries(raw).forEach(([ key, value ]) => {
      const id = Number(key);
      if (!id || !Array.isArray(value)) return;
      out[id] = value.map(name => path.basename(String(name || ''))).filter(Boolean);
    });
    return out;
  }

  async storedPicks(projectId, shotId) {
    const rows = await this.ctx.model.ShotBinding.findAll({
      where: { project_id: projectId, shot_id: shotId },
    });
    const out = {};
    let any = false;
    rows.forEach(row => {
      if (row.refmod_files == null || row.refmod_files === '') return;
      const list = parseJson(row.refmod_files, null);
      if (!Array.isArray(list)) return;
      out[row.asset_id] = list.map(name => path.basename(String(name || ''))).filter(Boolean);
      any = true;
    });
    return any ? out : null;
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

  async lockCharacterIds(projectId, shot, requestedIds, parts) {
    const requested = [ ...new Set((requestedIds || []).map(id => Number(id)).filter(id => id > 0)) ];
    const visuals = await this.ctx.model.Asset.findAll({
      where: { project_id: projectId, kind: [ 'character', 'scene' ], disabled: false },
    });
    const allowed = new Set(visuals.map(row => row.id));
    const picked = requested.filter(id => allowed.has(id));
    const fields = Array.isArray(shot?.overridden_fields) ? shot.overridden_fields : [];
    if (fields.includes('assets')) return picked;
    const extra = mentionedAssetIds(shotText(parts || {}), visuals)
      .map(id => Number(id))
      .filter(id => allowed.has(id) && !picked.includes(id));
    return picked.concat(extra);
  }

  async composePrompt(projectId, assetIds, shotPrompt, options) {
    const pictures = options === true || options?.pictures === true;
    const lock = Boolean(options && typeof options === 'object' && options.lock);
    const ids = [ ...new Set((assetIds || []).map(id => Number(id)).filter(id => id > 0)) ];
    const assets = ids.length
      ? await this.ctx.model.Asset.findAll({ where: { project_id: projectId, id: ids } })
      : [];
    const byId = new Map(assets.map(row => [ row.id, row ]));
    const ordered = ids
      .map(id => byId.get(id))
      .filter(row => row && !row.disabled && VISUAL_KINDS.has(row.kind));
    const used = lock ? ordered.filter(row => row.kind === 'character' || row.kind === 'scene') : ordered;
    const packs = used.length
      ? await this.ctx.model.Refmod.findAll({
        where: { project_id: projectId, asset_id: used.map(row => row.id) },
      })
      : [];
    const packByAsset = new Map(packs.map(row => [ row.asset_id, row ]));
    const lines = [];
    const refmodIds = [];
    const picks = options?.picks || null;
    let cursor = 1;
    used.forEach(asset => {
      const pack = packByAsset.get(asset.id);
      const names = pack ? chosenNames(fileNames(pack.images), asset.id, picks) : [];
      const notes = pack ? noteMap(pack.image_notes) : {};
      const label = KIND_LABEL[asset.kind] || '资产';
      const who = lock
        ? `${asset.kind === 'scene' ? '场景' : '角色'}「${asset.name}」`
        : `${label}「${asset.name}」`;
      const pictureLines = [];
      if (pictures && names.length) {
        names.forEach(name => {
          const note = noteText(notes[name]);
          pictureLines.push(note
            ? `<Picture ${cursor}>：${note}。这张图属于${who}`
            : `<Picture ${cursor}> 是${who}的参考图`);
          cursor += 1;
        });
        refmodIds.push(pack.id);
      }
      const brief = assetBrief(asset);
      if (lock) {
        const head = pictureLines.length
          ? `${pictureLines.join('\n')}\n这些图都是${who}，按每张图自己的说明使用，不要互相替代`
          : (asset.kind === 'scene'
            ? `${who}。锁定这个场景的空间、陈设和结构，本段画面保持一致`
            : `${who}。锁定这张脸、体态和服装，本段画面保持一致`);
        lines.push(brief ? `${head}。${brief}` : head);
        return;
      }
      const head = pictureLines.length ? pictureLines.join('\n') : who;
      lines.push(brief ? `${head}。${brief}` : head);
    });
    const shot = String(shotPrompt || '').trim();
    const positive = lines.length
      ? [ lines.join('\n'), lock ? shot : (shot ? `镜头：${shot}` : '') ].filter(Boolean).join('\n')
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
    const saved = [];
    const notes = {};
    images.forEach((file, index) => {
      const image = decodeImage(file);
      const filename = `${index}${image.ext}`;
      fs.writeFileSync(path.join(dir, filename), image.bytes);
      saved.push(filename);
      const note = noteText(file.note);
      if (note) notes[filename] = note;
    });
    await row.update({ images: JSON.stringify(saved), image_notes: JSON.stringify(notes) });
    return { ...this.present(await row.reload()), asset_name: asset.name, asset_kind: asset.kind };
  }

  async update(projectId, id, payload) {
    const row = await this.owned(projectId, id);
    let images = fileNames(row.images);
    const notes = noteMap(row.image_notes);
    const remove = (Array.isArray(payload?.remove) ? payload.remove : [])
      .map(name => path.basename(String(name || '')))
      .filter(name => images.includes(name));
    if (remove.length) {
      const dir = path.join(outputRoot(this.app), 'refmods', String(projectId), String(row.id));
      remove.forEach(name => {
        fs.rmSync(path.join(dir, name), { force: true });
        delete notes[name];
      });
      images = images.filter(name => !remove.includes(name));
    }
    if (payload?.notes && typeof payload.notes === 'object' && !Array.isArray(payload.notes)) {
      images.forEach(name => {
        if (payload.notes[name] == null) return;
        const note = noteText(payload.notes[name]);
        if (note) notes[name] = note;
        else delete notes[name];
      });
    }
    const incoming = Array.isArray(payload?.images) ? payload.images : [];
    if (images.length + incoming.length > MAX_PER_PACK) this.ctx.throw(400, `一个包最多 ${MAX_PER_PACK} 张图`);
    if (incoming.length) {
      const dir = path.join(outputRoot(this.app), 'refmods', String(projectId), String(row.id));
      fs.mkdirSync(dir, { recursive: true });
      let cursor = images.reduce((max, name) => {
        const num = Number(String(name).replace(/\..*$/, ''));
        return Number.isFinite(num) ? Math.max(max, num) : max;
      }, -1);
      incoming.forEach(file => {
        cursor += 1;
        const image = decodeImage(file);
        const filename = `${cursor}${image.ext}`;
        fs.writeFileSync(path.join(dir, filename), image.bytes);
        images.push(filename);
        const note = noteText(file.note);
        if (note) notes[filename] = note;
      });
    }
    if (!images.length) this.ctx.throw(400, '至少留一张参考图');
    await row.update({ images: JSON.stringify(images), image_notes: JSON.stringify(notes) });
    const asset = row.asset_id ? await this.ctx.model.Asset.findByPk(row.asset_id) : null;
    return { ...this.present(await row.reload()), asset_name: asset?.name || row.name, asset_kind: asset?.kind || row.kind };
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
      const images = fileNames(found.images);
      if (!base || !images.includes(base)) this.ctx.throw(404, '图片不存在');
      const relative = path.join('refmods', String(projectId), String(found.id), base);
      const absolute = resolveInside(outputRoot(this.app), relative);
      if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '图片不存在');
      return absolute;
    });
  }

  async imageFiles(projectId, ids, picks = null) {
    const files = [];
    for (const id of ids || []) {
      const row = await this.owned(projectId, id);
      const images = chosenNames(fileNames(row.images), row.asset_id, picks);
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
