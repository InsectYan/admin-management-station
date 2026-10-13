'use strict';

const Service = require('egg').Service;
const { VISUAL_STYLES, SHOT_SIZES, CAMERA_MOVES, assertEnum } = require('../lib/cartoonMeta');

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

class ProjectService extends Service {
  list() {
    return this.ctx.model.Project.findAll({ order: [[ 'id', 'DESC' ]] });
  }

  async show(id) {
    const project = await this.ctx.model.Project.findByPk(id);
    if (!project) this.ctx.throw(404, '项目不存在');
    try {
      await this.ctx.service.generate.settleProject(id);
    } catch (err) {
      this.ctx.logger.warn('[cartoon] settle %s', err.message);
    }
    const [ imports, assets, shots ] = await Promise.all([
      this.ctx.model.Import.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.Asset.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.Shot.findAll({ where: { project_id: id }, order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]] }),
    ]);
    const shotIds = shots.map(item => item.id);
    const prompts = shotIds.length
      ? await this.ctx.model.Prompt.findAll({ where: { shot_id: shotIds } })
      : [];
    const promptByShot = new Map(prompts.map(item => [ item.shot_id, item ]));
    const tasks = await this.ctx.model.Task.findAll({
      where: { project_id: id },
      order: [[ 'id', 'DESC' ]],
    });
    const taskIds = tasks.map(item => item.id);
    const outputs = taskIds.length
      ? await this.ctx.model.Output.findAll({ where: { task_id: taskIds }, order: [[ 'id', 'ASC' ]] })
      : [];
    const shotById = new Map(shots.map(item => [ item.id, item ]));
    return {
      project,
      imports,
      assets,
      shots: shots.map(shot => ({
        ...shot.toJSON(),
        prompt: promptByShot.get(shot.id) || null,
      })),
      tasks: tasks.map(task => ({
        ...task.toJSON(),
        shot_description: shotById.get(task.shot_id)?.description || '',
        outputs: outputs.filter(item => item.task_id === task.id),
      })),
    };
  }

  create(payload) {
    return this.ctx.model.Project.create({
      name: payload.name,
      source_novel_id: payload.source_novel_id || null,
      visual_style: assertEnum(payload.visual_style, VISUAL_STYLES, '画面风格'),
      summary: payload.summary || '',
      status: 'draft',
    });
  }

  async update(id, payload) {
    const project = await this.ctx.model.Project.findByPk(id);
    if (!project) this.ctx.throw(404, '项目不存在');
    const patch = {};
    if (payload.name != null) patch.name = String(payload.name).trim();
    if (payload.summary != null) patch.summary = payload.summary;
    if (payload.source_novel_id !== undefined) patch.source_novel_id = payload.source_novel_id || null;
    if (payload.visual_style !== undefined) {
      patch.visual_style = assertEnum(payload.visual_style, VISUAL_STYLES, '画面风格');
    }
    await project.update(patch);
    return project;
  }

  async listNovels() {
    const data = await this.fetchNovel('/api/novels?page=1&pageSize=100');
    const list = Array.isArray(data) ? data : (data?.list || []);
    return list.map(item => ({
      id: item.id,
      title: item.title || `小说 #${item.id}`,
    }));
  }

  async listChapters(novelId) {
    const data = await this.fetchNovel(`/api/novels/${encodeURIComponent(novelId)}/chapters`);
    const list = Array.isArray(data) ? data : (data?.list || []);
    return list.map(item => ({
      id: item.chapter_id || item.id,
      title: item.title || '未命名章节',
      order: item.order,
    }));
  }

  async fetchNovel(urlPath) {
    const base = this.config.novel.baseUrl.replace(/\/$/, '');
    let res;
    try {
      res = await fetch(`${base}${urlPath}`, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
      this.ctx.throw(502, `无法连接小说平台：${err.message}`);
    }
    if (!res.ok) this.ctx.throw(502, `小说接口返回 ${res.status}`);
    return unwrap(await res.json());
  }

  async addImport(projectId, payload) {
    await this.show(projectId);
    if (!payload.body) this.ctx.throw(400, '快照正文不能为空');
    return this.ctx.model.Import.create({
      project_id: Number(projectId),
      source_novel_id: payload.source_novel_id || null,
      chapter_title: payload.chapter_title || '',
      body: payload.body,
      characters: payload.characters || [],
    });
  }

  async pullNovel(projectId, payload) {
    await this.show(projectId);
    let novel;
    let chapter;
    try {
      novel = await this.fetchNovel(`/api/novels/${payload.novel_id}`);
      if (payload.chapter_id) {
        chapter = await this.fetchNovel(`/api/novels/${payload.novel_id}/chapters/${payload.chapter_id}`);
      }
    } catch (err) {
      if (err.status) throw err;
      this.ctx.throw(502, `无法连接小说平台：${err.message}`);
    }
    const body = chapter?.content || chapter?.body || chapter?.text || '';
    if (!body) this.ctx.throw(400, '没有拿到章节正文。可以改用手工粘贴快照');
    const characters = novel?.setting_json?.characters || [];
    const row = await this.addImport(projectId, {
      source_novel_id: String(payload.novel_id),
      chapter_title: chapter?.title || novel?.title || '',
      body,
      characters,
    });
    if (!payload.keep_unlinked) {
      await this.ctx.model.Project.update(
        { source_novel_id: String(payload.novel_id) },
        { where: { id: projectId } },
      );
    }
    return row;
  }

  async addShot(projectId, payload) {
    await this.show(projectId);
    const max = await this.ctx.model.Shot.max('sort_order', { where: { project_id: projectId } });
    const shot = await this.ctx.model.Shot.create({
      project_id: Number(projectId),
      sort_order: Number.isFinite(max) ? max + 1 : 0,
      shot_size: assertEnum(payload.shot_size || '中景', SHOT_SIZES, '景别') || '中景',
      camera_move: assertEnum(payload.camera_move || '固定', CAMERA_MOVES, '运镜') || '固定',
      description: payload.description || '',
    });
    if (payload.positive_zh || payload.negative_zh) {
      await this.ctx.model.Prompt.create({
        shot_id: shot.id,
        positive_zh: payload.positive_zh || '',
        negative_zh: payload.negative_zh || '',
      });
    }
    return shot;
  }

  async updateShot(id, payload) {
    const shot = await this.ctx.model.Shot.findByPk(id);
    if (!shot) this.ctx.throw(404, '分镜不存在');
    await shot.update({
      shot_size: payload.shot_size ?? shot.shot_size,
      camera_move: payload.camera_move ?? shot.camera_move,
      description: payload.description ?? shot.description,
      sort_order: payload.sort_order ?? shot.sort_order,
    });
    if (payload.positive_zh != null || payload.negative_zh != null) {
      const existing = await this.ctx.model.Prompt.findOne({ where: { shot_id: shot.id } });
      if (existing) {
        await existing.update({
          positive_zh: payload.positive_zh ?? existing.positive_zh,
          negative_zh: payload.negative_zh ?? existing.negative_zh,
        });
      } else {
        await this.ctx.model.Prompt.create({
          shot_id: shot.id,
          positive_zh: payload.positive_zh || '',
          negative_zh: payload.negative_zh || '',
        });
      }
    }
    return shot;
  }
}

module.exports = ProjectService;
