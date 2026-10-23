'use strict';

const Service = require('egg').Service;
const { VISUAL_STYLES, SHOT_SIZES, CAMERA_MOVES, assertEnum } = require('../lib/cartoonMeta');
const { sameBody, keepsProductionText, withOverride } = require('../lib/rebasePlan');
const { reportAudit } = require('../lib/reportAudit');
const { videoTemplateDraft, templateGaps } = require('../lib/videoTemplates');
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
    const episode = await this.ensureEpisode(project.id);
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
    const copyBlocks = await this.ctx.model.CopyBlock.findAll({
      where: { project_id: id },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    return {
      project,
      imports,
      assets,
      copy_blocks: copyBlocks,
      gaps: templateGaps(project.template_id, project, assets),
      shots: shots.map(shot => ({
        ...shot.toJSON(),
        prompt: promptByShot.get(shot.id) || null,
      })),
      tasks: tasks.map(task => ({
        ...task.toJSON(),
        shot_description: shotById.get(task.shot_id)?.description || '',
        outputs: outputs.filter(item => item.task_id === task.id),
      })),
      episodes: [ episode ],
    };
  }

  async ensureEpisode(projectId) {
    let episode = await this.ctx.model.VideoTask.findOne({
      where: { project_id: projectId },
      order: [[ 'episode_no', 'ASC' ]],
    });
    if (!episode) {
      episode = await this.ctx.model.VideoTask.create({
        project_id: Number(projectId),
        episode_no: 1,
        title: '第1集',
        current_node: 'input',
        status: 'draft',
      });
    }
    await this.ctx.model.Shot.update(
      { video_task_id: episode.id },
      { where: { project_id: projectId, video_task_id: null } },
    );
    return episode;
  }

  async touchNode(projectId, taskId, currentNode) {
    const allowed = [ 'input', 'script', 'storyboard', 'assets', 'generate', 'compose', 'preview', 'export' ];
    if (!allowed.includes(currentNode)) {
      const err = new Error('节点不存在');
      err.status = 400;
      throw err;
    }
    const episode = await this.ctx.model.VideoTask.findOne({
      where: { id: taskId, project_id: projectId },
    });
    if (!episode) {
      const err = new Error('这一集不存在');
      err.status = 404;
      throw err;
    }
    await episode.update({ current_node: currentNode });
    return episode;
  }

  create(payload) {
    const contentType = payload.content_type || 'ai_comic';
    const local = contentType === 'ai_science' || contentType === 'ai_commerce';
    if (![ 'ai_comic', 'ai_short', 'ai_science', 'ai_commerce' ].includes(contentType)) this.ctx.throw(400, '这个内容类型还没开放');
    if (local && payload.source_novel_id) this.ctx.throw(400, '这个类型不绑定小说');
    return this.ctx.model.Project.create({
      name: payload.name,
      source_novel_id: local ? null : (payload.source_novel_id || null),
      visual_style: assertEnum(payload.visual_style, VISUAL_STYLES, '画面风格'),
      summary: payload.summary || '',
      status: 'draft',
      content_type: contentType,
      pin_mode: local ? 'local' : 'required',
    });
  }

  async createFromTemplate(payload) {
    const draft = videoTemplateDraft(payload.template_id);
    const name = String(payload.name || '').trim();
    if (!name) this.ctx.throw(400, '需要项目名称');
    const project = await this.ctx.model.Project.create({
      name,
      source_novel_id: null,
      visual_style: assertEnum(payload.visual_style, VISUAL_STYLES, '画面风格'),
      summary: draft.scene,
      status: 'draft',
      content_type: draft.content_type,
      pin_mode: draft.content_type === 'ai_science' ? 'local' : 'required',
      template_id: draft.id,
    });
    const episode = await this.ensureEpisode(project.id);
    for (const block of draft.copy_blocks) {
      await this.ctx.model.CopyBlock.create({
        project_id: project.id,
        sort_order: block.sort_order,
        title: block.title,
        body: block.body,
      });
    }
    for (const shot of draft.shots) {
      await this.addShot(project.id, { description: shot.description });
    }
    return {
      project,
      episode_id: episode.id,
      needs_package: draft.needs_package,
    };
  }

  async update(id, payload) {
    const project = await this.ctx.model.Project.findByPk(id);
    if (!project) this.ctx.throw(404, '项目不存在');
    const patch = {};
    if (payload.name != null) patch.name = String(payload.name).trim();
    if (payload.summary != null) patch.summary = payload.summary;
    if (payload.source_novel_id !== undefined) {
      const local = project.content_type === 'ai_science' || project.content_type === 'ai_commerce';
      if (local && payload.source_novel_id) this.ctx.throw(400, '这个类型不绑定小说');
      patch.source_novel_id = local ? null : (payload.source_novel_id || null);
    }
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
      package_id: payload.package_id || null,
      package_version: payload.package_version || null,
      chapter_id: payload.chapter_id || null,
      body_hash: payload.body_hash || null,
      legacy_unpinned: Boolean(payload.legacy_unpinned),
      overridden_fields: payload.overridden_fields || [],
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
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    if (payload.package_id && payload.version) return this.pullPackage(project, payload);
    if ((project.pin_mode || 'required') !== 'legacy') {
      this.ctx.throw(400, '请先在叙事工作台发布故事包，再按版本拉取');
    }
    let novel;
    let chapter;
    try {
      novel = await this.fetchNovel(`/api/novels/${payload.novel_id}`);
      if (payload.chapter_id) {
        chapter = await this.fetchNovel(`/api/novels/${payload.novel_id}/chapters/${payload.chapter_id}`);
      }
    } catch (err) {
      if (err.status) throw err;
      this.ctx.throw(502, `无法连接叙事工作台：${err.message}`);
    }
    const setting = novel?.setting_json || {};
    const meta = (setting.chapters || []).find(item => String(item.id) === String(payload.chapter_id));
    const volume = indexOutlineVolumes(setting.outline?.volumes).get(String(meta?.outline_ref || '')) || '';
    const chapterTitle = meta?.title || chapter?.chapter?.title || chapter?.title || '';
    const body = chapter?.body || chapter?.content || chapter?.text || '';
    if (!body) this.ctx.throw(400, '没有拿到章节正文。可以改用手工粘贴快照');
    const row = await this.addImport(projectId, {
      source_novel_id: String(payload.novel_id),
      chapter_title: formatSnapshotTitle(volume, chapterTitle),
      body,
      characters: setting.characters || [],
      chapter_id: payload.chapter_id ? String(payload.chapter_id) : null,
      legacy_unpinned: true,
    });
    if (!payload.keep_unlinked) await project.update({ source_novel_id: String(payload.novel_id) });
    return row;
  }

  async pullPackage(project, payload) {
    const pack = await this.fetchNovel(
      `/api/packages/${encodeURIComponent(payload.package_id)}?version=${encodeURIComponent(payload.version)}`,
    );
    const chapter = (pack?.chapters || []).find(item => String(item.chapter_id) === String(payload.chapter_id));
    if (!chapter?.body) this.ctx.throw(400, '故事包里没有这一章正文');
    const { Op } = this.app.Sequelize;
    const existing = await this.ctx.model.Import.findOne({
      where: {
        project_id: project.id,
        chapter_id: String(chapter.chapter_id),
        deleted_at: { [Op.is]: null },
      },
      order: [[ 'id', 'DESC' ]],
    });
    const changed = existing ? !sameBody(existing, chapter) : false;
    let row = existing;
    let preserved = 0;
    if (existing) {
      await existing.update({
        chapter_title: chapter.title || existing.chapter_title,
        body: chapter.body,
        characters: pack.characters || existing.characters,
        package_id: pack.package_id,
        package_version: pack.version,
        body_hash: chapter.body_hash || null,
        legacy_unpinned: false,
        upstream_removed: false,
      });
      if (changed) {
        const shots = await this.ctx.model.Shot.findAll({ where: { import_id: existing.id } });
        preserved = shots.filter(keepsProductionText).length;
        await this.ctx.model.Shot.update(
          { upstream_stale: true, upstream_version: pack.version },
          { where: { import_id: existing.id } },
        );
      }
    } else {
      row = await this.addImport(project.id, {
        source_novel_id: String(pack.narrative_project_id || payload.novel_id || ''),
        chapter_title: chapter.title || '未命名章节',
        body: chapter.body,
        characters: pack.characters || [],
        package_id: pack.package_id,
        package_version: pack.version,
        chapter_id: String(chapter.chapter_id),
        body_hash: chapter.body_hash || null,
        legacy_unpinned: false,
      });
    }
    await this.markRemovedChapters(project.id, pack);
    await project.update({
      source_novel_id: String(pack.narrative_project_id || payload.novel_id || project.source_novel_id || ''),
      package_id: pack.package_id,
      package_version: pack.version,
      content_type: project.content_type || 'ai_comic',
    });
    await this.notifyDownstream(project);
    await reportAudit(this.ctx, {
      action: 'video.pin',
      external_id: project.id,
      detail: {
        package_id: pack.package_id,
        version: pack.version,
        chapter_id: String(chapter.chapter_id),
        updated: Boolean(existing && changed),
        preserved_shots: preserved,
      },
    });
    return {
      id: row.id,
      updated: Boolean(existing && changed),
      unchanged: Boolean(existing && !changed),
      preserved_shots: preserved,
      package_version: pack.version,
    };
  }

  async markRemovedChapters(projectId, pack) {
    const liveIds = new Set((pack.chapters || []).map(item => String(item.chapter_id)));
    const rows = await this.ctx.model.Import.findAll({
      where: { project_id: projectId, package_id: pack.package_id },
    });
    for (const row of rows) {
      if (row.deleted_at || !row.chapter_id) continue;
      const removed = !liveIds.has(String(row.chapter_id));
      if (Boolean(row.upstream_removed) !== removed) await row.update({ upstream_removed: removed });
    }
  }

  async rebase(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    if (!project.package_id) this.ctx.throw(400, '这个项目还没有钉扎故事包');
    if (!payload.version || !payload.chapter_id) this.ctx.throw(400, '需要目标版本和章节');
    return this.pullPackage(project, {
      package_id: project.package_id,
      version: payload.version,
      chapter_id: payload.chapter_id,
      novel_id: project.source_novel_id,
    });
  }

  async listNovelPackages(novelId) {
    return this.fetchNovel(`/api/novels/${encodeURIComponent(novelId)}/packages`);
  }

  async notifyDownstream(project) {
    if (!project.package_id || !project.source_novel_id) return;
    const base = this.config.novel.baseUrl.replace(/\/$/, '');
    try {
      await fetch(`${base}/api/internal/downstreams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative_project_id: project.source_novel_id,
          package_id: project.package_id,
          version: project.package_version,
          video_project_id: String(project.id),
          content_type: project.content_type || 'ai_comic',
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      this.ctx.logger.warn('[cartoon] downstream %s', err.message);
    }
  }

  async promoteShot(shotId, payload) {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot) this.ctx.throw(404, '分镜不存在');
    const project = await this.ctx.model.Project.findByPk(shot.project_id);
    const chapter = shot.import_id ? await this.ctx.model.Import.findByPk(shot.import_id) : null;
    if (!project?.package_id || !chapter?.chapter_id) this.ctx.throw(400, '这个镜头还没有钉扎故事包章节');
    const base = this.config.novel.baseUrl.replace(/\/$/, '');
    let res;
    try {
      res = await fetch(`${base}/api/internal/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_project_id: String(project.id),
          shot_id: String(shot.id),
          narrative_project_id: project.source_novel_id,
          chapter_id: chapter.chapter_id,
          package_version: chapter.package_version || project.package_version,
          field: 'dialogue',
          before: payload.before,
          after: payload.after,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      this.ctx.throw(502, `无法连接叙事工作台：${err.message}`);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.code && json.code !== 0 && json.code !== 200)) {
      this.ctx.throw(json.code || res.status || 400, json.message || '提升失败');
    }
    const fields = new Set(Array.isArray(shot.overridden_fields) ? shot.overridden_fields : []);
    fields.add('dialogue');
    await shot.update({ dialogue: payload.after || shot.dialogue, overridden_fields: [ ...fields ] });
    await reportAudit(this.ctx, {
      action: 'video.promote',
      external_id: shot.id,
      detail: {
        project_id: project.id,
        chapter_id: chapter.chapter_id,
        package_version: chapter.package_version || project.package_version,
      },
    });
    return json.data || null;
  }

  async dashboard() {
    const summary = await this.ctx.service.opsInternal.summary({});
    const { Op } = this.app.Sequelize;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [ unpinned, createdToday, recent ] = await Promise.all([
      this.ctx.model.Project.count({ where: { pin_mode: 'required', package_id: null } }),
      this.ctx.model.Project.count({ where: { created_at: { [Op.gte]: start } } }),
      this.ctx.model.Task.findAll({
        where: {
          updated_at: { [Op.gte]: dayAgo },
          status: { [Op.in]: [ 'success', 'failed' ] },
        },
        attributes: [ 'status' ],
      }),
    ]);
    const success = recent.filter(item => item.status === 'success').length;
    return {
      generating: summary.running + summary.backlog,
      failed: summary.today_failed,
      unpinned,
      created_today: createdToday,
      success_rate_24h: recent.length ? Math.round((success / recent.length) * 100) : null,
    };
  }

  async requireScience(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    if (project.content_type !== 'ai_science' && project.content_type !== 'ai_commerce') this.ctx.throw(400, '这个类型使用本地文案');
    return project;
  }

  async listCopyBlocks(projectId) {
    await this.requireScience(projectId);
    return this.ctx.model.CopyBlock.findAll({
      where: { project_id: projectId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  async saveCopyBlock(projectId, blockId, payload) {
    await this.requireScience(projectId);
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    if (!title && !body) this.ctx.throw(400, '需要标题或正文');
    const fields = {
      title,
      body,
      sort_order: Number(payload.sort_order) || 1,
    };
    if (blockId) {
      const row = await this.ctx.model.CopyBlock.findOne({ where: { id: blockId, project_id: projectId } });
      if (!row) this.ctx.throw(404, '文案不存在');
      await row.update(fields);
      return row;
    }
    return this.ctx.model.CopyBlock.create({ project_id: Number(projectId), ...fields });
  }

  async removeCopyBlock(projectId, blockId) {
    await this.requireScience(projectId);
    const row = await this.ctx.model.CopyBlock.findOne({ where: { id: blockId, project_id: projectId } });
    if (!row) this.ctx.throw(404, '文案不存在');
    await row.destroy();
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
    const episode = await this.ensureEpisode(projectId);
    const max = await this.ctx.model.Shot.max('sort_order', { where: { project_id: projectId } });
    const shot = await this.ctx.model.Shot.create({
      project_id: Number(projectId),
      import_id: importId,
      video_task_id: episode.id,
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

  async addAsset(projectId, payload) {
    await this.show(projectId);
    const name = String(payload.name || '').trim();
    if (!name) this.ctx.throw(400, '需要资产名称');
    const kinds = [ 'character', 'scene', 'prop', 'voice' ];
    const kind = kinds.includes(payload.kind) ? payload.kind : 'character';
    const voiceKey = String(payload.voice_key || '').trim();
    if (kind === 'voice' && !voiceKey) this.ctx.throw(400, '需要音色标识');
    return this.ctx.model.Asset.create({
      project_id: Number(projectId),
      kind,
      name,
      description: payload.description || '',
      reference_path: String(payload.reference_path || '').trim(),
      voice_key: voiceKey,
      speech_rate: String(payload.speech_rate || '').trim(),
      emotion: String(payload.emotion || '').trim(),
    });
  }

  async updateShot(id, payload) {
    const shot = await this.ctx.model.Shot.findByPk(id);
    if (!shot) this.ctx.throw(404, '分镜不存在');
    await shot.update({
      shot_size: payload.shot_size ?? shot.shot_size,
      camera_move: payload.camera_move ?? shot.camera_move,
      description: payload.description ?? shot.description,
      sort_order: payload.sort_order ?? shot.sort_order,
      dialogue: payload.dialogue ?? shot.dialogue,
      overridden_fields: withOverride(shot, payload),
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

  async savePanel(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const text = key => String(payload[key] || '').trim();
    let fields = null;
    if (project.content_type === 'ai_short') {
      fields = {
        conflict: text('conflict'),
        twist: text('twist'),
        rhythm: text('rhythm'),
        branches: text('branches'),
      };
    } else if (project.content_type === 'ai_commerce') {
      fields = {
        product_note: text('product_note'),
        selling_points: text('selling_points'),
        comparison: text('comparison'),
      };
    } else this.ctx.throw(400, '这个类型没有面板');
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    if (row) await row.update(fields);
    else await this.ctx.model.TypePanel.create({ project_id: project.id, ...fields });
    return this.panelOf(project.id);
  }

  async panelOf(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    return {
      content_type: project.content_type,
      ready: await this.panelReady(project),
      panel: row,
    };
  }

  async panelReady(projectOrId) {
    const project = projectOrId && projectOrId.content_type
      ? projectOrId
      : await this.ctx.model.Project.findByPk(projectOrId);
    if (!project) this.ctx.throw(404, '项目不存在');
    if (project.content_type !== 'ai_short' && project.content_type !== 'ai_commerce') return true;
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    const filled = key => Boolean(String(row?.[key] || '').trim());
    if (project.content_type === 'ai_short') return filled('conflict') && filled('twist') && filled('rhythm') && filled('branches');
    return filled('product_note') && filled('selling_points');
  }
}

module.exports = ProjectService;
