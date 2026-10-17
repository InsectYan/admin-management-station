'use strict';

const Service = require('egg').Service;
const { VISUAL_STYLES, SHOT_SIZES, CAMERA_MOVES, assertEnum } = require('../lib/cartoonMeta');

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function indexOutlineVolumes(volumes) {
  const map = new Map();
  for (const vol of volumes || []) {
    const title = String(vol?.title || '').trim();
    const put = node => {
      if (!node) return;
      if (node.id) map.set(String(node.id), title);
      if (node.title) map.set(String(node.title), title);
    };
    put(vol);
    for (const group of vol.groups || []) {
      put(group);
      for (const section of group.sections || []) put(section);
    }
  }
  return map;
}

function formatSnapshotTitle(volumeTitle, chapterTitle) {
  const chapter = String(chapterTitle || '').trim() || '未命名章节';
  const volume = String(volumeTitle || '').trim();
  if (!volume || volume === '未关联大纲' || volume === '未命名卷') return chapter;
  if (chapter.startsWith(`${volume}·`)) return chapter;
  return `${volume}·${chapter}`;
}

function novelBriefOf(novel) {
  const themes = (novel?.themes || []).map(item => item.name).filter(Boolean);
  return {
    id: novel?.id,
    title: novel?.title || '',
    creative_intent: novel?.creative_intent || '',
    summary: novel?.summary || '',
    story_overview: novel?.story_overview || '',
    genre: novel?.genre || '',
    genre_subcategory: novel?.genre_subcategory || '',
    novel_type: novel?.novel_type || '',
    themes,
    target_audience: novel?.target_audience || '',
    update_cadence: novel?.update_cadence || '',
    author_name: novel?.author_name || '',
    progress_status: novel?.progress_status || '',
    progress_percent: novel?.progress_percent ?? null,
    word_count: novel?.word_count ?? null,
    chapter_written: novel?.chapter_written ?? null,
    chapter_total: novel?.chapter_total ?? null,
  };
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
    const imports = await this.ctx.model.Import.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] });
    await this.repairSnapshotTitles(project, imports);
    const [ assets, shots ] = await Promise.all([
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

  async novelBrief(novelId) {
    const novel = await this.fetchNovel(`/api/novels/${encodeURIComponent(novelId)}`);
    if (!novel?.id) this.ctx.throw(404, '小说不存在');
    return novelBriefOf(novel);
  }

  async listChapters(novelId) {
    const novel = await this.fetchNovel(`/api/novels/${encodeURIComponent(novelId)}`);
    const setting = novel?.setting_json || {};
    const volumes = indexOutlineVolumes(setting.outline?.volumes);
    const chapters = Array.isArray(setting.chapters) ? setting.chapters : [];
    return chapters
      .map((item, index) => {
        const title = item.title || '未命名章节';
        const volume = volumes.get(String(item.outline_ref || '')) || '';
        return {
          id: item.id,
          title,
          volume,
          label: formatSnapshotTitle(volume, title),
          order: Number(item.order) || index + 1,
        };
      })
      .filter(item => item.id)
      .sort((a, b) => a.order - b.order);
  }

  async repairSnapshotTitles(project, imports) {
    const pending = imports.filter(item => item.source_novel_id && !String(item.chapter_title || '').includes('·'));
    if (!pending.length) return;
    let reader;
    try {
      reader = await this.fetchNovel(`/api/novels/${encodeURIComponent(project.source_novel_id || pending[0].source_novel_id)}/reader`);
    } catch (err) {
      this.ctx.logger.warn('[cartoon] retitle %s', err.message);
      return;
    }
    const chapters = [];
    for (const volume of reader?.volumes || []) {
      for (const chapter of volume.chapters || []) {
        const body = String(chapter.body || '').trim();
        if (!body) continue;
        chapters.push({
          title: formatSnapshotTitle(volume.title, chapter.title),
          body,
        });
      }
    }
    for (const item of pending) {
      const body = String(item.body || '').trim();
      if (!body) continue;
      const needle = body.slice(0, 120);
      const hit = chapters.find(chapter => chapter.body === body || chapter.body.startsWith(needle));
      if (!hit || item.chapter_title === hit.title) continue;
      await item.update({ chapter_title: hit.title });
    }
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

  async removeImport(projectId, importId) {
    const row = await this.ctx.model.Import.findOne({
      where: { id: importId, project_id: projectId },
    });
    if (!row) this.ctx.throw(404, '章节快照不存在');
    if (!row.deleted_at) await row.update({ deleted_at: new Date() });
    return row;
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
    const setting = novel?.setting_json || {};
    const meta = (setting.chapters || []).find(item => String(item.id) === String(payload.chapter_id));
    const volume = indexOutlineVolumes(setting.outline?.volumes).get(String(meta?.outline_ref || '')) || '';
    const chapterTitle = meta?.title || chapter?.chapter?.title || chapter?.title || '';
    const body = chapter?.body || chapter?.content || chapter?.text || '';
    if (!body) this.ctx.throw(400, '没有拿到章节正文。可以改用手工粘贴快照');
    const characters = setting.characters || [];
    const row = await this.addImport(projectId, {
      source_novel_id: String(payload.novel_id),
      chapter_title: formatSnapshotTitle(volume, chapterTitle),
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
    let importId = null;
    if (payload.import_id) {
      const chapter = await this.ctx.model.Import.findOne({
        where: { id: payload.import_id, project_id: projectId },
      });
      if (!chapter) this.ctx.throw(404, '章节快照不存在');
      importId = chapter.id;
    }
    const max = await this.ctx.model.Shot.max('sort_order', { where: { project_id: projectId } });
    const shot = await this.ctx.model.Shot.create({
      project_id: Number(projectId),
      import_id: importId,
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
