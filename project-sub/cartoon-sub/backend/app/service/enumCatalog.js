'use strict';

const Service = require('egg').Service;
const { CATALOGS, catalogOf } = require('../lib/enumCatalog');
const { VISUAL_STYLES, STYLE_CLASSES, SHOT_SIZES, CAMERA_MOVES, applyVisualStyles, applyStyleClasses, applyShotSizes, applyCameraMoves } = require('../lib/cartoonMeta');
const { TOPIC_OPTIONS, applyTopicOptions } = require('../lib/topics');
const { TYPES, applyContentTypes } = require('../lib/contentCatalog');

const BINDS = new Set([ 'required', 'optional', 'local' ]);
let ready = null;

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function clip(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function longText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function codeOf(value, label) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 80) throw bad(`${label}需要 1 到 80 个字`);
  if (/[,，]/.test(text)) throw bad(`${label}里不能有逗号`);
  return text;
}

function tokens(value) {
  return String(value || '').split(/[,，]/).map(item => item.trim()).filter(Boolean);
}

function layerCodes(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw || '{}');
    } catch {
      data = {};
    }
  }
  if (!data || typeof data !== 'object') return [];
  return Object.values(data).map(item => String(item || '').trim()).filter(Boolean);
}

function topicValues(raw) {
  if (Array.isArray(raw)) return raw.map(item => String(item || '').trim()).filter(Boolean);
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return tokens(text);
  }
}

function present(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name || '',
    group_name: row.group_name || '',
    note: row.note || '',
    prompt: row.prompt || '',
    bind: row.bind || '',
    sort_order: row.sort_order || 0,
  };
}

class EnumCatalogService extends Service {
  async ensure() {
    if (!ready) {
      ready = this.seedAndHydrate().catch(err => {
        ready = null;
        throw err;
      });
    }
    return ready;
  }

  async seedAndHydrate() {
    const EnumItem = this.ctx.model.EnumItem;
    const seeds = {
      visual_style: VISUAL_STYLES.map((item, index) => ({
        catalog: 'visual_style',
        code: item.value,
        name: item.name,
        group_name: item.group || '',
        note: item.note || '',
        prompt: item.prompt || '',
        sort_order: index,
      })),
      style_class: STYLE_CLASSES.flatMap(group => group.options.map((item, index) => ({
        catalog: 'style_class',
        code: item.value,
        name: item.name,
        group_name: group.name,
        note: item.note || '',
        prompt: item.prompt || '',
        sort_order: index,
      }))),
      shot_size: SHOT_SIZES.map((name, index) => ({
        catalog: 'shot_size',
        code: name,
        name,
        sort_order: index,
      })),
      camera_move: CAMERA_MOVES.map((name, index) => ({
        catalog: 'camera_move',
        code: name,
        name,
        sort_order: index,
      })),
      topic: TOPIC_OPTIONS.map((item, index) => ({
        catalog: 'topic',
        code: item.value,
        name: item.label,
        sort_order: index,
      })),
      content_type: TYPES.map((item, index) => ({
        catalog: 'content_type',
        code: item.id,
        name: item.label,
        bind: item.bind || 'local',
        sort_order: index,
      })),
    };
    const classCodes = STYLE_CLASSES.flatMap(group => group.options.map(item => item.value));
    if (classCodes.length) {
      await EnumItem.update(
        { catalog: 'style_class' },
        { where: { catalog: 'visual_style', code: classCodes } },
      );
    }
    for (const group of STYLE_CLASSES) {
      for (const option of group.options) {
        const row = await EnumItem.findOne({ where: { catalog: 'style_class', code: option.value } });
        if (!row) continue;
        const name = String(row.name || '');
        if (name.startsWith(group.name) && name !== option.name) {
          await row.update({ name: option.name, group_name: group.name });
        }
      }
    }
    for (const catalog of CATALOGS) {
      const count = await EnumItem.count({ where: { catalog: catalog.key } });
      if (count) continue;
      const rows = seeds[catalog.key] || [];
      if (rows.length) await EnumItem.bulkCreate(rows);
    }
    await this.hydrate();
  }

  async rowsOf(key) {
    return this.ctx.model.EnumItem.findAll({
      where: { catalog: key },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  async hydrate() {
    const grouped = {};
    for (const catalog of CATALOGS) {
      grouped[catalog.key] = (await this.rowsOf(catalog.key)).map(present);
    }
    applyVisualStyles(grouped.visual_style);
    applyStyleClasses(grouped.style_class);
    applyShotSizes(grouped.shot_size);
    applyCameraMoves(grouped.camera_move);
    applyTopicOptions(grouped.topic);
    applyContentTypes(grouped.content_type);
  }

  async list() {
    await this.ensure();
    const EnumItem = this.ctx.model.EnumItem;
    const counts = new Map();
    const rows = await EnumItem.findAll({ attributes: [ 'catalog' ], raw: true });
    rows.forEach(row => counts.set(row.catalog, (counts.get(row.catalog) || 0) + 1));
    return CATALOGS.map(item => ({
      key: item.key,
      name: item.name,
      description: item.description,
      item_count: counts.get(item.key) || 0,
    }));
  }

  async usage() {
    const projects = await this.ctx.model.Project.findAll({
      attributes: [ 'id', 'name', 'visual_style', 'style_layers', 'content_type', 'topics', 'av_mode', 'deleted_at' ],
      raw: true,
    });
    const shots = await this.ctx.model.Shot.findAll({
      attributes: [ 'id', 'shot_code', 'shot_size', 'camera_move' ],
      raw: true,
    });
    return {
      projects: projects.filter(item => !item.deleted_at),
      shots,
    };
  }

  referencesFor(catalog, item, usage) {
    let hits = [];
    if (catalog === 'visual_style' || catalog === 'style_class') {
      hits = usage.projects.filter(row => row.visual_style === item.code || layerCodes(row.style_layers).includes(item.code)).map(row => row.name || `项目 ${row.id}`);
    } else if (catalog === 'content_type') {
      hits = usage.projects.filter(row => row.content_type === item.code).map(row => row.name || `项目 ${row.id}`);
    } else if (catalog === 'topic') {
      hits = usage.projects.filter(row => {
        const values = topicValues(row.topics);
        if (values.includes(item.code)) return true;
        return item.code === 'av' && row.av_mode && !values.length;
      }).map(row => row.name || `项目 ${row.id}`);
    } else if (catalog === 'shot_size' || catalog === 'camera_move') {
      const column = catalog === 'shot_size' ? 'shot_size' : 'camera_move';
      hits = usage.shots.filter(row => tokens(row[column]).includes(item.code)).map(row => row.shot_code || `镜头 ${row.id}`);
    }
    return {
      count: hits.length,
      samples: hits.slice(0, 5),
    };
  }

  async show(key) {
    const catalog = catalogOf(key);
    if (!catalog) throw bad('没有这个枚举');
    await this.ensure();
    const usage = await this.usage();
    const items = (await this.rowsOf(catalog.key)).map(row => {
      const item = present(row);
      item.references = this.referencesFor(catalog.key, item, usage);
      return item;
    });
    return {
      key: catalog.key,
      name: catalog.name,
      description: catalog.description,
      fields: catalog.fields,
      items,
    };
  }

  readPayload(catalog, payload, current) {
    const next = {
      code: current?.code || '',
      name: current?.name || '',
      group_name: current?.group_name || '',
      note: current?.note || '',
      prompt: current?.prompt || '',
      bind: current?.bind || '',
    };
    for (const field of catalog.fields) {
      if (payload[field.key] === undefined && current) continue;
      if (field.key === 'code') next.code = codeOf(payload.code, '编码');
      else if (field.key === 'name') next.name = codeOf(payload.name, '名称').slice(0, 80);
      else if (field.key === 'group_name') next.group_name = clip(payload.group_name, 40);
      else if (field.key === 'note') next.note = longText(payload.note, 500);
      else if (field.key === 'prompt') next.prompt = longText(payload.prompt, 8000);
      else if (field.key === 'bind') {
        const bind = String(payload.bind || 'local').trim();
        if (!BINDS.has(bind)) throw bad('绑定方式不在可选范围内');
        next.bind = bind;
      }
    }
    if (catalog.key === 'shot_size' || catalog.key === 'camera_move') next.code = next.name;
    if (catalog.key === 'content_type' && !next.bind) next.bind = 'local';
    if (!next.code) throw bad('请填写编码');
    if ((catalog.key === 'visual_style' || catalog.key === 'topic' || catalog.key === 'content_type') && !next.name) {
      throw bad('请填写名称');
    }
    return next;
  }

  async assertUnique(catalog, code, ignoreId) {
    const { Op } = this.app.Sequelize;
    const where = { catalog, code };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const clash = await this.ctx.model.EnumItem.findOne({ where });
    if (clash) throw bad('这个编码已经有了');
  }

  async rewriteCode(catalog, from, to) {
    if (!from || from === to) return;
    if (catalog === 'visual_style') {
      await this.ctx.model.Project.update({ visual_style: to }, { where: { visual_style: from } });
      return;
    }
    if (catalog === 'content_type') {
      await this.ctx.model.Project.update({ content_type: to }, { where: { content_type: from } });
      return;
    }
    if (catalog === 'topic') {
      const projects = await this.ctx.model.Project.findAll({ attributes: [ 'id', 'topics' ], raw: true });
      for (const project of projects) {
        const values = topicValues(project.topics);
        if (!values.includes(from)) continue;
        const next = [];
        values.forEach(item => {
          const value = item === from ? to : item;
          if (value && !next.includes(value)) next.push(value);
        });
        await this.ctx.model.query(
          'UPDATE cartoon_projects SET topics = $1, av_mode = $2 WHERE id = $3',
          { bind: [ JSON.stringify(next), next.includes('av'), project.id ] },
        );
      }
      return;
    }
    if (catalog === 'shot_size' || catalog === 'camera_move') {
      const column = catalog === 'shot_size' ? 'shot_size' : 'camera_move';
      const shots = await this.ctx.model.Shot.findAll({ attributes: [ 'id', column ], raw: true });
      for (const shot of shots) {
        const parts = tokens(shot[column]);
        if (!parts.includes(from)) continue;
        const next = [];
        parts.forEach(item => {
          const value = item === from ? to : item;
          if (value && !next.includes(value)) next.push(value);
        });
        await this.ctx.model.Shot.update({ [column]: next.join(',') }, { where: { id: shot.id } });
      }
    }
  }

  async create(key, payload) {
    const catalog = catalogOf(key);
    if (!catalog) throw bad('没有这个枚举');
    await this.ensure();
    const next = this.readPayload(catalog, payload, null);
    await this.assertUnique(catalog.key, next.code);
    const max = await this.ctx.model.EnumItem.max('sort_order', { where: { catalog: catalog.key } });
    const row = await this.ctx.model.EnumItem.create({
      ...next,
      catalog: catalog.key,
      sort_order: Number.isFinite(Number(max)) ? Number(max) + 1 : 0,
    });
    await this.hydrate();
    return present(row);
  }

  async update(key, id, payload) {
    const catalog = catalogOf(key);
    if (!catalog) throw bad('没有这个枚举');
    await this.ensure();
    const row = await this.ctx.model.EnumItem.findOne({ where: { id: Number(id), catalog: catalog.key } });
    if (!row) {
      const err = new Error('这条枚举不存在');
      err.status = 404;
      throw err;
    }
    const next = this.readPayload(catalog, payload, present(row));
    await this.assertUnique(catalog.key, next.code, row.id);
    const previous = row.code;
    await row.update(next);
    await this.rewriteCode(catalog.key, previous, next.code);
    await this.hydrate();
    return present(row);
  }
}

module.exports = EnumCatalogService;
