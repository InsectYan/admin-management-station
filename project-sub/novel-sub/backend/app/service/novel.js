'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');
const { formatDateTime } = require('../lib/formatDateTime');

const NOVEL_INCLUDES = [
  { association: 'genreCategory', attributes: ['id', 'name'] },
  { association: 'genreSubcategory', attributes: ['id', 'name', 'parent_id'] },
  { association: 'lengthCategory', attributes: ['id', 'name'] },
  { association: 'audienceCategory', attributes: ['id', 'name'] },
  { association: 'updatePace', attributes: ['id', 'name'] },
  { association: 'themes', attributes: ['id', 'name', 'heat_level'], through: { attributes: [] } },
];

class NovelService extends Service {
  serialize(row) {
    if (!row) return null;
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    const {
      genreCategory,
      genreSubcategory,
      lengthCategory,
      audienceCategory,
      updatePace,
      themes: rawThemes,
      ...rest
    } = json;
    const themes = (rawThemes || []).map((t) => ({ id: t.id, name: t.name, heat_level: t.heat_level }));
    return {
      ...rest,
      created_at: formatDateTime(rest.created_at),
      updated_at: formatDateTime(rest.updated_at),
      genre: genreCategory?.name || rest.genre || null,
      genre_subcategory: genreSubcategory?.name || null,
      novel_type: lengthCategory?.name || rest.novel_type || null,
      target_audience: audienceCategory?.name || rest.target_audience || null,
      update_cadence: updatePace?.name || rest.update_cadence || null,
      theme_ids: themes.map((t) => t.id),
      themes,
    };
  }

  buildWhere(query = {}) {
    const where = {};
    if (query.title) {
      where.title = { [Op.iLike]: `%${query.title}%` };
    }
    if (query.genre) where.genre = query.genre;
    if (query.genre_category_id) where.genre_category_id = Number(query.genre_category_id);
    if (query.novel_type) where.novel_type = query.novel_type;
    if (query.length_id) where.length_id = Number(query.length_id);
    if (query.progress_status) where.progress_status = query.progress_status;
    if (query.status) where.status = query.status;
    return where;
  }

  buildOrder(query = {}) {
    const field = query.sortField || 'updated_at';
    const allowed = ['title', 'genre', 'novel_type', 'progress_status', 'created_at', 'updated_at'];
    const sortField = allowed.includes(field) ? field : 'updated_at';
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    return [[sortField, sortOrder]];
  }

  async resolveEnumFields(payload = {}) {
    const { GenreCategory, GenreSubcategory, LengthCategory, AudienceCategory, UpdatePace, ThemeCategory } = this.ctx.model;
    const next = { ...payload };

    if (next.genre_category_id) {
      const cat = await GenreCategory.findByPk(next.genre_category_id);
      if (cat) next.genre = cat.name;
    }
    if (next.genre_subcategory_id) {
      const sub = await GenreSubcategory.findByPk(next.genre_subcategory_id);
      if (sub) {
        next.genre_subcategory_id = sub.id;
        if (!next.genre_category_id) next.genre_category_id = sub.parent_id;
      }
    }
    if (next.length_id) {
      const length = await LengthCategory.findByPk(next.length_id);
      if (length) next.novel_type = length.name;
    }
    if (next.audience_id) {
      const audience = await AudienceCategory.findByPk(next.audience_id);
      if (audience) next.target_audience = audience.name;
    } else if (typeof next.target_audience === 'string' && next.target_audience.includes(',')) {
      next.target_audience = next.target_audience.split(',')[0].trim();
    }
    if (next.update_pace_id) {
      const pace = await UpdatePace.findByPk(next.update_pace_id);
      if (pace) next.update_cadence = pace.name;
    }

    let themes = null;
    if (Array.isArray(next.theme_ids)) {
      const ids = next.theme_ids.map(Number).filter(Boolean);
      themes = ids.length ? await ThemeCategory.findAll({ where: { id: { [Op.in]: ids } } }) : [];
    }

    delete next.theme_ids;
    delete next.themes;
    delete next.genre_path;
    delete next.genre_subcategory;
    delete next.progress_percent;
    delete next.word_count;
    delete next.word_target;
    delete next.chapter_written;
    delete next.chapter_total;
    delete next.health_score;
    delete next.health_status;
    delete next.health_summary;
    return { fields: next, themes };
  }

  async list(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const { rows, count } = await this.ctx.model.Novel.findAndCountAll({
      where: this.buildWhere(query),
      include: NOVEL_INCLUDES,
      distinct: true,
      order: this.buildOrder(query),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return { list: await this.attachProgress(rows), total: count, page, pageSize };
  }

  async findById(id) {
    const row = await this.ctx.model.Novel.findByPk(id, { include: NOVEL_INCLUDES });
    if (!row) return null;
    const [item] = await this.attachProgress([row]);
    return item;
  }

  async create(payload) {
    const { fields, themes } = await this.resolveEnumFields(payload);
    const row = await this.ctx.model.Novel.create(fields);
    if (themes) await row.setThemes(themes);
    return this.findById(row.id);
  }

  async update(id, payload) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    const { fields, themes } = await this.resolveEnumFields(payload);
    await row.update(fields);
    if (themes) await row.setThemes(themes);
    return this.findById(id);
  }

  async remove(id) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return false;
    await row.destroy();
    return true;
  }

  async batchRemove(ids) {
    const numericIds = (ids || []).map(Number).filter(Boolean);
    if (!numericIds.length) return 0;
    return this.ctx.model.Novel.destroy({
      where: { id: { [Op.in]: numericIds } },
    });
  }

  mergeSettingJson(current, patch) {
    const base = current && typeof current === 'object' ? current : {};
    const next = { ...base };
    for (const key of Object.keys(patch || {})) {
      const val = patch[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        next[key] = { ...base[key], ...val };
      } else {
        next[key] = val;
      }
    }
    return next;
  }

  async getSetting(id) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    return row.setting_json || {};
  }

  async updateSetting(id, patch) {
    const row = await this.ctx.model.Novel.findByPk(id);
    if (!row) return null;
    const next = this.mergeSettingJson(row.setting_json, patch);
    await row.update({ setting_json: next });
    return next;
  }

  countBodyWords(text) {
    const raw = String(text || '');
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = trimmed
      .replace(/[\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    return cjk + latin;
  }

  listSettingChapters(setting) {
    const chapters = Array.isArray(setting?.chapters) ? [...setting.chapters] : [];
    return chapters
      .map((ch, idx) => ({
        id: String(ch?.id || '').trim(),
        title: String(ch?.title || '').trim() || '未命名章节',
        order: Number(ch?.order) || idx + 1,
        faction: ch?.faction || 'hero',
        outline_ref: ch?.outline_ref || '',
      }))
      .filter((ch) => ch.id)
      .sort((a, b) => a.order - b.order);
  }

  outlineWordTarget(setting) {
    let total = 0;
    for (const vol of setting?.outline?.volumes || []) {
      total += Number(vol?.word_target) || 0;
      for (const group of vol.groups || []) {
        total += Number(group?.word_target) || 0;
        for (const sec of group.sections || []) {
          total += Number(sec?.word_target) || 0;
        }
      }
    }
    return total;
  }

  estimateBookWordTarget(novelRow) {
    const length = novelRow?.lengthCategory;
    const min = Number(length?.min_words) || 0;
    const max = Number(length?.max_words) || 0;
    if (min && max) return Math.round((min + max) / 2);
    return min || max || 80000;
  }

  buildProgressStats(novelRow, setting, bodyRows = []) {
    const chapters = this.listSettingChapters(setting);
    const byId = new Map((bodyRows || []).map((row) => [
      row.chapter_id,
      Number(row.word_count) || 0,
    ]));
    let written = 0;
    let done = 0;
    for (const ch of chapters) {
      const wc = byId.get(ch.id) || 0;
      written += wc;
      if (wc > 0) done += 1;
    }
    const outlineTarget = this.outlineWordTarget(setting);
    const target = outlineTarget > 0 ? outlineTarget : this.estimateBookWordTarget(novelRow);
    const percent = target > 0 ? Math.min(100, Math.max(0, Math.round((written / target) * 100))) : 0;
    return {
      word_count: written,
      word_target: target,
      chapter_written: done,
      chapter_total: chapters.length,
      progress_percent: percent,
    };
  }

  async loadBodyMetaForNovels(ids) {
    if (!ids.length) return new Map();
    const rows = await this.ctx.model.NovelChapterBody.findAll({
      where: { novel_id: { [Op.in]: ids } },
      attributes: ['novel_id', 'chapter_id', 'word_count'],
    });
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.novel_id)) map.set(row.novel_id, []);
      map.get(row.novel_id).push(row);
    }
    return map;
  }

  healthFromSetting(setting = {}) {
    const qa = setting?.qa;
    if (!qa || typeof qa !== 'object') {
      return { health_score: null, health_status: 'unknown', health_summary: '' };
    }
    return {
      health_score: Number.isFinite(Number(qa.score)) ? Number(qa.score) : null,
      health_status: qa.status || 'unknown',
      health_summary: qa.summary || '',
    };
  }

  async attachProgress(rows) {
    const ids = rows.map((row) => row.id);
    const bodiesByNovel = await this.loadBodyMetaForNovels(ids);
    return rows.map((row) => {
      const json = this.serialize(row);
      const setting = row.setting_json || {};
      const stats = this.buildProgressStats(row, setting, bodiesByNovel.get(row.id) || []);
      const health = this.healthFromSetting(setting);
      return { ...json, ...stats, ...health };
    });
  }

  matchChapterToOutline(chapter, title, id) {
    const ref = String(chapter?.outline_ref || '').trim();
    if (!ref) return false;
    return ref === String(id || '') || ref === String(title || '');
  }

  buildReaderVolumes(setting, bodyById) {
    const chapters = this.listSettingChapters(setting);
    const used = new Set();
    const pack = (list) => list.map((ch) => {
      const bodyRow = bodyById.get(ch.id);
      const body = bodyRow?.body || '';
      return {
        id: ch.id,
        title: ch.title,
        order: ch.order,
        body,
        word_count: bodyRow ? Number(bodyRow.word_count) || 0 : this.countBodyWords(body),
      };
    });
    const takeFor = (title, id) => {
      const hit = chapters.filter((ch) => {
        if (used.has(ch.id)) return false;
        if (!this.matchChapterToOutline(ch, title, id)) return false;
        used.add(ch.id);
        return true;
      });
      return pack(hit);
    };
    const volumes = setting?.outline?.volumes || [];
    if (!volumes.length) {
      return [{ id: 'flat', title: '', chapters: pack(chapters) }];
    }
    const tree = volumes.map((vol) => {
      const volChapters = [];
      for (const group of vol.groups || []) {
        for (const sec of group.sections || []) {
          volChapters.push(...takeFor(sec.title, sec.id));
        }
        volChapters.push(...takeFor(group.title, group.id));
      }
      volChapters.push(...takeFor(vol.title, vol.id));
      return {
        id: vol.id,
        title: vol.title || '未命名卷',
        chapters: volChapters,
      };
    });
    const leftover = chapters.filter((ch) => !used.has(ch.id));
    if (leftover.length) {
      tree.push({ id: 'unlinked', title: '未关联大纲', chapters: pack(leftover) });
    }
    return tree;
  }

  neighborMeta(chapters, chapterId) {
    const index = chapters.findIndex((ch) => ch.id === chapterId);
    if (index < 0) return { prev: null, next: null, index: -1 };
    const toMeta = (ch) => (ch ? {
      id: ch.id,
      title: ch.title,
      order: ch.order,
      outline_ref: ch.outline_ref || '',
    } : null);
    return {
      prev: toMeta(chapters[index - 1]),
      next: toMeta(chapters[index + 1]),
      index,
    };
  }

  excerptOf(text, max = 800) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return value.slice(0, max);
  }

  endingOf(text, max = 800) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return value.slice(-max);
  }

  findOutlineNode(volumes, ref) {
    const key = String(ref || '').trim();
    if (!key) return null;
    for (const vol of volumes || []) {
      if (String(vol.id) === key || String(vol.title || '') === key) return vol;
      for (const group of vol.groups || []) {
        if (String(group.id) === key || String(group.title || '') === key) return group;
        for (const sec of group.sections || []) {
          if (String(sec.id) === key || String(sec.title || '') === key) return sec;
        }
      }
    }
    return null;
  }

  estimateChapterWordTarget(novelRow, chapterCount, outlineNode) {
    const fromOutline = Number(outlineNode?.word_target) || 0;
    if (fromOutline > 0) return fromOutline;
    const length = novelRow?.lengthCategory;
    const min = Number(length?.min_words) || 0;
    const max = Number(length?.max_words) || 0;
    const mid = min && max ? Math.round((min + max) / 2) : (min || max || 80000);
    const n = Math.max(Number(chapterCount) || 1, 1);
    return Math.max(1500, Math.round(mid / n));
  }

  formatNextOutline(next) {
    if (!next) return '';
    const ref = String(next.outline_ref || '').trim();
    return ref ? `${next.title}（${ref}）` : String(next.title || '');
  }

  async loadNovelWithLength(novelId) {
    return this.ctx.model.Novel.findByPk(novelId, {
      include: [{ association: 'lengthCategory', attributes: ['id', 'name', 'min_words', 'max_words'] }],
    });
  }

  async getChapterWriteContext(novelId, chapterId) {
    const row = await this.loadNovelWithLength(novelId);
    if (!row) return null;
    const setting = row.setting_json || {};
    const chapters = this.listSettingChapters(setting);
    const current = chapters.find((ch) => ch.id === chapterId);
    if (!current) {
      const err = new Error('章节不存在');
      err.status = 404;
      err.code = 'CHAPTER_NOT_FOUND';
      throw err;
    }
    const bodyRow = await this.ctx.model.NovelChapterBody.findOne({
      where: { novel_id: novelId, chapter_id: chapterId },
    });
    const { prev, next } = this.neighborMeta(chapters, chapterId);
    let prevEnding = '';
    if (prev) {
      const prevRow = await this.ctx.model.NovelChapterBody.findOne({
        where: { novel_id: novelId, chapter_id: prev.id },
        attributes: ['body'],
      });
      prevEnding = this.endingOf(prevRow?.body, 800);
    }
    const outlineNode = this.findOutlineNode(setting.outline?.volumes, current.outline_ref);
    const body = bodyRow?.body || '';
    return {
      chapter: current,
      body,
      word_count: bodyRow ? Number(bodyRow.word_count) || 0 : this.countBodyWords(body),
      updated_at: bodyRow ? formatDateTime(bodyRow.updated_at) : '',
      prev,
      next,
      prev_ending: prevEnding,
      next_outline: this.formatNextOutline(next),
      word_target: this.estimateChapterWordTarget(row, chapters.length, outlineNode),
    };
  }

  async firstEmptyChapter(novelId) {
    const list = await this.listEmptyChapters(novelId);
    if (list === null) return null;
    return list[0] || null;
  }

  async listEmptyChapters(novelId) {
    const meta = await this.listChapterMeta(novelId);
    if (!meta) return null;
    return meta
      .filter((row) => !(Number(row.word_count) > 0))
      .map((row) => ({
        chapter_id: row.chapter_id,
        title: row.title,
        order: row.order,
      }));
  }

  async getReader(novelId) {
    const row = await this.loadNovelWithLength(novelId);
    if (!row) return null;
    const setting = row.setting_json || {};
    const bodies = await this.ctx.model.NovelChapterBody.findAll({
      where: { novel_id: novelId },
      attributes: ['chapter_id', 'body', 'word_count'],
    });
    const bodyById = new Map(bodies.map((item) => [item.chapter_id, item]));
    const stats = this.buildProgressStats(row, setting, bodies);
    return {
      title: row.title,
      ...stats,
      volumes: this.buildReaderVolumes(setting, bodyById),
    };
  }

  async buildChapterAgentSnapshot(novelId, chapterId, base = {}) {
    const ctx = await this.getChapterWriteContext(novelId, chapterId);
    if (!ctx) return base;
    const setting = await this.getSetting(novelId);
    const world = setting.world || {};
    return {
      ...base,
      chapter: ctx.chapter,
      body_excerpt: this.excerptOf(ctx.body, 800),
      prev_chapter: ctx.prev
        ? { id: ctx.prev.id, title: ctx.prev.title, ending: ctx.prev_ending || '' }
        : null,
      next_outline: ctx.next_outline || '',
      word_target: ctx.word_target,
      words_written: ctx.word_count || 0,
      factions: setting.factions || [],
      characters: setting.characters || [],
      world: {
        era: world.era || '',
        power_system: world.power_system || '',
      },
    };
  }

  async listChapterMeta(novelId) {
    const row = await this.ctx.model.Novel.findByPk(novelId);
    if (!row) return null;
    const chapters = this.listSettingChapters(row.setting_json);
    const bodies = await this.ctx.model.NovelChapterBody.findAll({
      where: { novel_id: novelId },
      attributes: ['chapter_id', 'word_count', 'updated_at'],
    });
    const byId = new Map(bodies.map((item) => [item.chapter_id, item]));
    return chapters.map((ch) => {
      const body = byId.get(ch.id);
      return {
        chapter_id: ch.id,
        title: ch.title,
        order: ch.order,
        word_count: body ? Number(body.word_count) || 0 : 0,
        updated_at: body ? formatDateTime(body.updated_at) : '',
      };
    });
  }

  async getChapterBody(novelId, chapterId) {
    return this.getChapterWriteContext(novelId, chapterId);
  }

  async upsertChapterBody(novelId, chapterId, body) {
    const row = await this.ctx.model.Novel.findByPk(novelId);
    if (!row) return null;
    const chapters = this.listSettingChapters(row.setting_json);
    const current = chapters.find((ch) => ch.id === chapterId);
    if (!current) {
      const err = new Error('章节不存在');
      err.status = 404;
      err.code = 'CHAPTER_NOT_FOUND';
      throw err;
    }
    const text = String(body || '');
    const wordCount = this.countBodyWords(text);
    const [record] = await this.ctx.model.NovelChapterBody.findOrCreate({
      where: { novel_id: novelId, chapter_id: chapterId },
      defaults: { body: text, word_count: wordCount },
    });
    if (record.body !== text || record.word_count !== wordCount) {
      await record.update({ body: text, word_count: wordCount });
    }
    return this.getChapterWriteContext(novelId, chapterId);
  }
}

module.exports = NovelService;
