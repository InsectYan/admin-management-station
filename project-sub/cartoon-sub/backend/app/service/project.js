'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;
const { outputRoot, resolveInside } = require('../lib/mediaPaths');
const {
  VISUAL_STYLES, assertEnum, assertShotSizes, serializeShotSizes, normalizeShotSizes,
  assertCameraMoves, serializeCameraMoves, normalizeCameraMoves,
} = require('../lib/cartoonMeta');
const { sameBody, keepsProductionText, withOverride } = require('../lib/rebasePlan');
const { reportAudit } = require('../lib/reportAudit');
const { videoTemplateDraft, templateGaps } = require('../lib/videoTemplates');
const { auditShot, mentionedAssetIds, shotText } = require('../lib/shotAssets');
const {
  contentType,
  isLocal,
  pinModeOf,
  LEGACY_KEYS,
  panelFields,
  panelReady: fieldsReady,
  normalizePanel,
} = require('../lib/contentCatalog');
function assetFileNames(projectId, row) {
  const marker = `/projects/${projectId}/asset-files/`;
  const raw = [ row.front_path, row.side_path, row.back_path, row.reference_path, row.angle_paths ]
    .filter(Boolean)
    .join('\n');
  const names = new Set();
  raw.split(/[\n,，]/).forEach(part => {
    const text = String(part || '').trim();
    const index = text.indexOf(marker);
    if (index < 0) return;
    const name = path.basename(text.slice(index + marker.length).split(/[?#]/)[0]);
    if (/^[a-z0-9]+\.(png|jpe?g|webp)$/i.test(name)) names.add(name);
  });
  return [ ...names ];
}

function decodeAssetImage(file) {
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
    const imports = await this.ctx.model.Import.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] });
    await this.repairSnapshotTitles(project, imports);
    await this.ensureShotCodes(id);
    const [ assets, shots ] = await Promise.all([
      this.ctx.model.Asset.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] }),
      this.ctx.model.Shot.findAll({ where: { project_id: id }, order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]] }),
    ]);
    const shotIds = shots.map(item => item.id);
    const prompts = shotIds.length
      ? await this.ctx.model.Prompt.findAll({ where: { shot_id: shotIds } })
      : [];
    const promptByShot = new Map(prompts.map(item => [ item.shot_id, item ]));
    const importById = new Map(imports.map(item => [ item.id, item ]));
    let bindings = await this.ctx.model.ShotBinding.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] });
    bindings = await this.fillMentionedAssets(id, shots, assets, importById, promptByShot, bindings);
    const pendingTasks = await this.ctx.model.Task.findAll({
      where: { project_id: id },
      order: [[ 'id', 'DESC' ]],
    });
    const promptIds = pendingTasks
      .filter(item => item.prompt_id && [ 'queued', 'running', 'saving' ].includes(item.status))
      .map(item => item.prompt_id);
    const [ , live ] = await Promise.all([
      this.ctx.service.generate.settleProject(id).catch(err => {
        this.ctx.logger.warn('[cartoon] settle %s', err.message);
      }),
      this.ctx.service.generate.liveProgress(promptIds).catch(err => {
        this.ctx.logger.warn('[cartoon] progress %s', err.message);
        return {};
      }),
    ]);
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
    let taskViews = tasks.map(task => ({
      ...this.ctx.service.generate.presentTask(task),
      ...(live[task.prompt_id] || {}),
      shot_description: shotById.get(task.shot_id)?.description || '',
      outputs: outputs.filter(item => item.task_id === task.id),
    }));
    if (taskViews.some(item => item.generation?.workflow_id && !item.generation.workflow_name)) {
      try {
        const names = await this.ctx.service.generate.workflowNames();
        taskViews = taskViews.map(item => {
          if (!item.generation?.workflow_id || item.generation.workflow_name) return item;
          const name = names.get(Number(item.generation.workflow_id)) || '';
          if (!name) return item;
          return { ...item, generation: { ...item.generation, workflow_name: name } };
        });
      } catch (err) {
        this.ctx.logger.warn('[cartoon] workflow names %s', err.message);
      }
    }
    return {
      project,
      imports,
      assets,
      copy_blocks: copyBlocks,
      gaps: templateGaps(project.template_id, project, assets),
      shots: shots.map(shot => {
        const json = shot.toJSON();
        const sizes = normalizeShotSizes(json.shot_size);
        const moves = normalizeCameraMoves(json.camera_move);
        return {
          ...json,
          shot_size: serializeShotSizes(sizes),
          shot_sizes: sizes,
          camera_move: serializeCameraMoves(moves),
          camera_moves: moves,
          prompt: promptByShot.get(shot.id) || null,
          asset_marks: this.assetMarksFor(shot, assets, importById, promptByShot, bindings),
        };
      }),
      tasks: taskViews,
      bindings,
      voice_cues: await this.ctx.model.VoiceCue.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] }),
      review_findings: await this.ctx.model.ReviewFinding.findAll({ where: { project_id: id }, order: [[ 'id', 'ASC' ]] }),
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
    const allowed = [ 'input', 'script', 'storyboard', 'assets', 'generate', 'voice', 'subtitle', 'compose', 'preview', 'review', 'export' ];
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
    const contentTypeId = payload.content_type || 'ai_comic';
    const type = contentType(contentTypeId);
    if (!type) this.ctx.throw(400, '这个内容类型还没开放');
    if (isLocal(contentTypeId) && payload.source_novel_id) this.ctx.throw(400, '这个类型不绑定小说');
    return this.ctx.model.Project.create({
      name: payload.name,
      source_novel_id: isLocal(contentTypeId) ? null : (payload.source_novel_id || null),
      visual_style: assertEnum(payload.visual_style, VISUAL_STYLES, '画面风格'),
      summary: payload.summary || '',
      status: 'draft',
      content_type: contentTypeId,
      pin_mode: pinModeOf(contentTypeId),
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
      pin_mode: pinModeOf(draft.content_type),
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
      if (isLocal(project.content_type) && payload.source_novel_id) this.ctx.throw(400, '这个类型不绑定小说');
      patch.source_novel_id = isLocal(project.content_type) ? null : (payload.source_novel_id || null);
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

  async maxShotCodeNum(projectId) {
    const rows = await this.ctx.model.Shot.findAll({
      where: { project_id: projectId },
      attributes: [ 'shot_code' ],
    });
    let max = 0;
    for (const row of rows) {
      const match = String(row.shot_code || '').trim().match(/^[A-Za-z](\d{6})$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return max;
  }

  async nextShotCode(projectId) {
    return `S${String((await this.maxShotCodeNum(projectId)) + 1).padStart(6, '0')}`;
  }

  async allocateShotCodes(projectId, count) {
    const start = await this.maxShotCodeNum(projectId);
    return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) => (
      `S${String(start + index + 1).padStart(6, '0')}`
    ));
  }

  async destroyShotsByIds(ids) {
    if (!ids.length) return 0;
    const { Op } = this.app.Sequelize;
    const tasks = await this.ctx.model.Task.findAll({ where: { shot_id: { [Op.in]: ids } } });
    const busy = tasks.find(item => [ 'queued', 'running', 'saving' ].includes(item.status));
    if (busy) this.ctx.throw(400, '有镜头正在生成，等它结束再删除');
    const taskIds = tasks.map(item => item.id);
    const outputs = taskIds.length
      ? await this.ctx.model.Output.findAll({ where: { task_id: { [Op.in]: taskIds } } })
      : [];
    const outputIds = outputs.map(item => item.id);
    if (outputIds.length) {
      await this.ctx.model.EditClip.update(
        { source_output_id: null },
        { where: { source_output_id: { [Op.in]: outputIds } } },
      );
      await this.ctx.model.ExportSpec.update(
        { source_output_id: null },
        { where: { source_output_id: { [Op.in]: outputIds } } },
      );
    }
    for (const task of tasks) await this.ctx.service.generate.removeTask(task.id);
    await this.ctx.model.Prompt.destroy({ where: { shot_id: { [Op.in]: ids } } });
    await this.ctx.model.ShotBinding.destroy({ where: { shot_id: { [Op.in]: ids } } });
    await this.ctx.model.VoiceCue.destroy({ where: { shot_id: { [Op.in]: ids } } });
    await this.ctx.model.ReviewFinding.destroy({ where: { shot_id: { [Op.in]: ids } } });
    await this.ctx.model.Shot.destroy({ where: { id: { [Op.in]: ids } } });
    return ids.length;
  }

  async clearImportShots(projectId, importId) {
    await this.show(projectId);
    const chapter = await this.ctx.model.Import.findOne({ where: { id: importId, project_id: projectId } });
    if (!chapter) this.ctx.throw(404, '章节快照不存在');
    const shots = await this.ctx.model.Shot.findAll({ where: { project_id: projectId, import_id: chapter.id } });
    const removed = await this.destroyShotsByIds(shots.map(item => item.id));
    if (chapter.script_data && typeof chapter.script_data === 'object') {
      await chapter.update({ script_data: { ...chapter.script_data, shot_omissions: [] } });
    }
    return { removed, import_id: Number(chapter.id) };
  }

  async removeImport(projectId, importId) {
    const row = await this.ctx.model.Import.findOne({
      where: { id: importId, project_id: projectId },
    });
    if (!row) this.ctx.throw(404, '章节快照不存在');
    const shots = await this.ctx.model.Shot.findAll({ where: { project_id: projectId, import_id: row.id } });
    await this.destroyShotsByIds(shots.map(item => item.id));
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
    await this.ensureCharacterDrafts(projectId, setting.characters || []);
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
    await this.ensureCharacterDrafts(project.id, pack.characters || []);
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
    const type = contentType(project.content_type);
    if (!type?.copy) this.ctx.throw(400, '这个类型使用本地文案');
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
    const durationSec = Number(payload.duration_sec);
    const durationMs = Number.isFinite(durationSec) && durationSec > 0
      ? Math.round(durationSec * 1000)
      : (Number(payload.duration_ms) > 0 ? Math.round(Number(payload.duration_ms)) : null);
    const shot = await this.ctx.model.Shot.create({
      project_id: Number(projectId),
      import_id: importId,
      video_task_id: episode.id,
      sort_order: Number.isFinite(max) ? max + 1 : 0,
      shot_code: payload.shot_code || await this.nextShotCode(projectId),
      shot_size: assertShotSizes(
        payload.shot_sizes != null ? payload.shot_sizes : (payload.shot_size || '中景'),
      ),
      camera_move: assertCameraMoves(
        payload.camera_moves != null ? payload.camera_moves : (payload.camera_move || '固定'),
      ),
      description: payload.description || '',
      dialogue: payload.dialogue || '',
      duration_ms: durationMs,
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

  assetFields(payload, kind, characterId) {
    const voiceKey = String(payload.voice_key || '').trim();
    if (kind === 'voice' && !voiceKey) this.ctx.throw(400, '需要音色标识');
    const sceneTypes = [ '室内', '室外', '城市', '自然', '古风', '品牌' ];
    const sceneType = String(payload.scene_type || '').trim();
    if (kind === 'scene' && sceneType && !sceneTypes.includes(sceneType)) this.ctx.throw(400, '场景类型不存在');
    const propCategories = [ '服饰', '器物', '食物', '文书', '交通', '其他' ];
    const propCategory = String(payload.prop_category || '').trim();
    if (kind === 'prop' && propCategory && !propCategories.includes(propCategory)) this.ctx.throw(400, '道具分类不存在');
    const character = kind === 'character';
    return {
      kind,
      name: String(payload.name || '').trim(),
      description: payload.description || '',
      reference_path: String(payload.reference_path || '').trim(),
      voice_key: voiceKey,
      speech_rate: String(payload.speech_rate || '').trim(),
      emotion: String(payload.emotion || '').trim(),
      character_id: character ? characterId : '',
      consistency_note: character ? String(payload.consistency_note || '').trim() : '',
      scene_type: kind === 'scene' ? sceneType : '',
      front_path: character ? String(payload.front_path || '').trim() : '',
      side_path: character ? String(payload.side_path || '').trim() : '',
      back_path: character ? String(payload.back_path || '').trim() : '',
      expression_note: character ? String(payload.expression_note || '').trim() : '',
      costume_note: character ? String(payload.costume_note || '').trim() : '',
      lora_ref: character ? String(payload.lora_ref || '').trim() : '',
      angle_paths: kind === 'scene' ? String(payload.angle_paths || '').trim() : '',
      prop_category: kind === 'prop' ? propCategory : '',
      voice_lang: kind === 'voice' ? String(payload.voice_lang || '').trim() : '',
      speaker_name: kind === 'voice' ? String(payload.speaker_name || '').trim() : '',
    };
  }

  async nextCharacterId(projectId) {
    for (let i = 0; i < 5; i += 1) {
      const characterId = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const hit = await this.ctx.model.Asset.findOne({ where: { project_id: projectId, character_id: characterId } });
      if (!hit) return characterId;
    }
    this.ctx.throw(500, '人物编号没有生成');
  }

  async addAsset(projectId, payload) {
    await this.show(projectId);
    const name = String(payload.name || '').trim();
    if (!name) this.ctx.throw(400, '需要资产名称');
    const kinds = [ 'character', 'scene', 'prop', 'voice', 'bgm', 'sfx', 'subtitle_style', 'transition' ];
    const kind = kinds.includes(payload.kind) ? payload.kind : 'character';
    let characterId = kind === 'character' ? String(payload.character_id || '').trim() : '';
    if (kind === 'character' && !characterId) characterId = await this.nextCharacterId(projectId);
    return this.ctx.model.Asset.create({
      project_id: Number(projectId),
      ...this.assetFields(payload, kind, characterId),
      disabled: false,
    });
  }

  async updateAsset(projectId, assetId, payload) {
    const row = await this.ctx.model.Asset.findOne({ where: { id: assetId, project_id: projectId } });
    if (!row) this.ctx.throw(404, '资产不存在');
    const kinds = [ 'character', 'scene', 'prop', 'voice', 'bgm', 'sfx', 'subtitle_style', 'transition' ];
    const kind = kinds.includes(payload.kind) ? payload.kind : row.kind;
    const name = String(payload.name || '').trim();
    if (!name) this.ctx.throw(400, '需要资产名称');
    let characterId = kind === 'character' ? String(payload.character_id || '').trim() : '';
    if (kind === 'character' && !characterId) characterId = row.character_id || await this.nextCharacterId(projectId);
    await row.update(this.assetFields({ ...payload, name }, kind, characterId));
    return row;
  }

  async saveAssetImage(projectId, payload) {
    await this.show(projectId);
    const image = decodeAssetImage(payload);
    const dir = path.join(outputRoot(this.app), 'asset-files', String(projectId));
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${image.ext}`;
    fs.writeFileSync(path.join(dir, filename), image.bytes);
    return { path: `/projects/${projectId}/asset-files/${filename}` };
  }

  assetImagePath(projectId, filename) {
    const base = path.basename(String(filename || ''));
    if (!/^[a-z0-9]+\.(png|jpg|webp)$/i.test(base)) this.ctx.throw(404, '图片不存在');
    const relative = path.join('asset-files', String(projectId), base);
    const absolute = resolveInside(outputRoot(this.app), relative);
    if (!absolute || !fs.existsSync(absolute)) this.ctx.throw(404, '图片不存在');
    return absolute;
  }

  async purgeShotGroup(projectId, payload) {
    await this.show(projectId);
    const importId = payload?.import_id;
    let chapter = null;
    let shots;
    if (importId == null || importId === '') {
      shots = await this.ctx.model.Shot.findAll({ where: { project_id: projectId, import_id: null } });
    } else {
      chapter = await this.ctx.model.Import.findOne({ where: { id: importId, project_id: projectId } });
      if (!chapter) this.ctx.throw(404, '章节快照不存在');
      if (!chapter.deleted_at && !payload?.clear_only) {
        this.ctx.throw(400, '只能删除已删除快照下的分镜，或未关联快照的分镜');
      }
      shots = await this.ctx.model.Shot.findAll({ where: { project_id: projectId, import_id: chapter.id } });
    }
    const removed = await this.destroyShotsByIds(shots.map(item => item.id));
    if (chapter && !payload?.clear_only) await chapter.destroy();
    return { removed, snapshot: chapter ? Number(chapter.id) : null };
  }

  async disableAsset(projectId, assetId) {
    const row = await this.ctx.model.Asset.findOne({ where: { id: assetId, project_id: projectId } });
    if (!row) this.ctx.throw(404, '资产不存在');
    await row.update({ disabled: true });
    return row;
  }

  async removeAsset(projectId, assetId) {
    const row = await this.ctx.model.Asset.findOne({ where: { id: assetId, project_id: projectId } });
    if (!row) this.ctx.throw(404, '资产不存在');
    const packs = await this.ctx.model.Refmod.findAll({ where: { project_id: projectId, asset_id: row.id } });
    for (const pack of packs) await this.ctx.service.refmod.remove(projectId, pack.id);
    const names = assetFileNames(projectId, row);
    if (names.length) {
      const { Op } = this.app.Sequelize;
      const others = await this.ctx.model.Asset.findAll({
        where: { project_id: projectId, id: { [Op.ne]: row.id } },
      });
      const shared = new Set();
      others.forEach(other => assetFileNames(projectId, other).forEach(name => shared.add(name)));
      names.forEach(name => {
        if (shared.has(name)) return;
        const absolute = resolveInside(outputRoot(this.app), path.join('asset-files', String(projectId), name));
        if (absolute) fs.rmSync(absolute, { force: true });
      });
    }
    await this.ctx.model.ShotBinding.destroy({ where: { asset_id: row.id } });
    await row.destroy();
    return { id: Number(assetId), refmods: packs.length, images: names.length };
  }

  async ensureCharacterDrafts(projectId, characters) {
    const list = Array.isArray(characters) ? characters : [];
    for (const item of list) {
      const name = String(typeof item === 'string' ? item : (item?.name || '')).trim();
      if (!name) continue;
      const characterId = String(typeof item === 'string' ? '' : (item.character_id || item.id || '')).trim();
      const existing = await this.ctx.model.Asset.findOne({
        where: { project_id: projectId, kind: 'character', name },
      });
      if (existing) {
        if (characterId && !existing.character_id) await existing.update({ character_id: characterId });
        continue;
      }
      await this.ctx.model.Asset.create({
        project_id: Number(projectId),
        kind: 'character',
        name,
        description: String(item?.appearance || item?.description || ''),
        character_id: characterId,
        disabled: false,
      });
    }
  }

  scriptOf(chapter) {
    if (!chapter) return {};
    const data = chapter.script_data && typeof chapter.script_data === 'object' ? chapter.script_data : {};
    return {
      ...data,
      characters: Array.isArray(data.characters) && data.characters.length ? data.characters : (chapter.characters || []),
    };
  }

  assetMarksFor(shot, assets, importById, promptByShot, bindings) {
    const prompt = promptByShot.get(shot.id);
    const boundIds = bindings
      .filter(item => Number(item.shot_id) === Number(shot.id))
      .map(item => item.asset_id);
    return auditShot({
      text: shotText({
        description: shot.description,
        dialogue: shot.dialogue,
        positive_zh: prompt?.positive_zh,
        negative_zh: prompt?.negative_zh,
      }),
      assets,
      script: this.scriptOf(importById.get(shot.import_id)),
      boundIds,
    });
  }

  async fillMentionedAssets(projectId, shots, assets, importById, promptByShot, bindings) {
    const boundByShot = new Map();
    bindings.forEach(item => {
      const key = Number(item.shot_id);
      const list = boundByShot.get(key) || [];
      list.push(Number(item.asset_id));
      boundByShot.set(key, list);
    });
    const creating = [];
    shots.forEach(shot => {
      const fields = Array.isArray(shot.overridden_fields) ? shot.overridden_fields : [];
      if (fields.includes('assets')) return;
      const prompt = promptByShot.get(shot.id);
      const text = shotText({
        description: shot.description,
        dialogue: shot.dialogue,
        positive_zh: prompt?.positive_zh,
        negative_zh: prompt?.negative_zh,
      });
      const have = new Set(boundByShot.get(Number(shot.id)) || []);
      mentionedAssetIds(text, assets).forEach(assetId => {
        const id = Number(assetId);
        if (have.has(id)) return;
        have.add(id);
        creating.push({
          project_id: Number(projectId),
          shot_id: Number(shot.id),
          asset_id: id,
          reason: '名称出现在剧情或提示词里',
        });
      });
    });
    if (!creating.length) return bindings;
    const rows = await this.ctx.model.ShotBinding.bulkCreate(creating);
    return bindings.concat(rows);
  }

  async saveShotAssets(projectId, shotId, payload) {
    const shot = await this.ctx.model.Shot.findByPk(shotId);
    if (!shot || String(shot.project_id) !== String(projectId)) this.ctx.throw(404, '分镜不存在');
    const assets = await this.ctx.model.Asset.findAll({ where: { project_id: projectId } });
    const allowed = new Set(assets
      .filter(asset => !asset.disabled && [ 'character', 'scene', 'prop' ].includes(asset.kind))
      .map(asset => Number(asset.id)));
    const assetIds = [ ...new Set((Array.isArray(payload.asset_ids) ? payload.asset_ids : [])
      .map(id => Number(id))
      .filter(id => id > 0)) ];
    if (assetIds.some(id => !allowed.has(id))) this.ctx.throw(400, '关联资产不在本项目里');
    const picks = payload.refmod_files && typeof payload.refmod_files === 'object' && !Array.isArray(payload.refmod_files)
      ? payload.refmod_files
      : {};
    await this.ctx.model.ShotBinding.destroy({ where: { project_id: projectId, shot_id: shot.id } });
    if (assetIds.length) {
      await this.ctx.model.ShotBinding.bulkCreate(assetIds.map(assetId => {
        const files = picks[assetId] ?? picks[String(assetId)];
        return {
          project_id: Number(projectId),
          shot_id: shot.id,
          asset_id: assetId,
          reason: '生成表单保存',
          refmod_files: Array.isArray(files) ? JSON.stringify(files) : null,
        };
      }));
    }
    if (payload.positive_zh != null || payload.negative_zh != null) {
      await this.updateShot(shot.id, {
        positive_zh: payload.positive_zh,
        negative_zh: payload.negative_zh,
      });
    }
    const fresh = await this.ctx.model.Shot.findByPk(shot.id);
    const fields = new Set(Array.isArray(fresh.overridden_fields) ? fresh.overridden_fields : []);
    fields.add('assets');
    await fresh.update({ overridden_fields: [ ...fields ] });
    const chapter = fresh.import_id ? await this.ctx.model.Import.findByPk(fresh.import_id) : null;
    const prompt = await this.ctx.model.Prompt.findOne({ where: { shot_id: fresh.id } });
    const marks = auditShot({
      text: shotText({
        description: payload.description != null ? payload.description : fresh.description,
        dialogue: payload.dialogue != null ? payload.dialogue : fresh.dialogue,
        positive_zh: payload.positive_zh != null ? payload.positive_zh : prompt?.positive_zh,
        negative_zh: payload.negative_zh != null ? payload.negative_zh : prompt?.negative_zh,
      }),
      assets,
      script: this.scriptOf(chapter),
      boundIds: assetIds,
    });
    return { marks, asset_ids: assetIds };
  }

  async bindMatchedAssets(projectId, shotId, text) {
    const source = String(text || '');
    const assets = await this.ctx.model.Asset.findAll({
      where: { project_id: projectId, disabled: false },
    });
    const hits = assets
      .filter(asset => [ 'character', 'scene', 'prop' ].includes(asset.kind) && asset.name && source.includes(asset.name))
      .sort((a, b) => String(b.name).length - String(a.name).length);
    const previous = await this.ctx.model.ShotBinding.findAll({
      where: { project_id: projectId, shot_id: shotId },
    });
    const keptFiles = new Map(previous.map(row => [ Number(row.asset_id), row.refmod_files ]));
    await this.ctx.model.ShotBinding.destroy({ where: { project_id: projectId, shot_id: shotId } });
    if (!hits.length) return [];
    await this.ctx.model.ShotBinding.bulkCreate(hits.map(asset => ({
      project_id: Number(projectId),
      shot_id: Number(shotId),
      asset_id: asset.id,
      reason: '名称出现在剧情或提示词里',
      refmod_files: keptFiles.has(Number(asset.id)) ? keptFiles.get(Number(asset.id)) : null,
    })));
    return hits.map(asset => asset.id);
  }

  async markRevised(shotId) {
    const tasks = await this.ctx.model.Task.findAll({ where: { shot_id: shotId, status: 'success' } });
    if (!tasks.length) return;
    const outputs = await this.ctx.model.Output.findAll({ where: { task_id: tasks.map(item => item.id) } });
    for (const output of outputs) {
      if (output.version_stage !== 'revised') await output.update({ version_stage: 'revised' });
    }
  }

  async updateShot(id, payload) {
    const shot = await this.ctx.model.Shot.findByPk(id);
    if (!shot) this.ctx.throw(404, '分镜不存在');
    const before = shot.toJSON();
    let durationMs = shot.duration_ms;
    if (payload.duration_sec != null) {
      const sec = Number(payload.duration_sec);
      if (Number.isFinite(sec) && sec > 0) durationMs = Math.round(sec * 1000);
    } else if (payload.duration_ms != null) {
      const ms = Number(payload.duration_ms);
      if (Number.isFinite(ms) && ms > 0) durationMs = Math.round(ms);
    }
    const nextShotSize = payload.shot_sizes != null || payload.shot_size != null
      ? assertShotSizes(payload.shot_sizes != null ? payload.shot_sizes : payload.shot_size)
      : shot.shot_size;
    const nextCamera = payload.camera_moves != null || payload.camera_move != null
      ? assertCameraMoves(payload.camera_moves != null ? payload.camera_moves : payload.camera_move)
      : shot.camera_move;
    const workflowId = Number(payload.workflow_id);
    const nextWorkflow = payload.workflow_id != null
      ? (Number.isInteger(workflowId) && workflowId > 0 ? workflowId : null)
      : shot.workflow_id;
    await shot.update({
      shot_size: nextShotSize,
      camera_move: nextCamera,
      description: payload.description ?? shot.description,
      sort_order: payload.sort_order ?? shot.sort_order,
      dialogue: payload.dialogue ?? shot.dialogue,
      duration_ms: durationMs,
      workflow_id: nextWorkflow,
      overridden_fields: withOverride(shot, {
        ...payload,
        shot_size: nextShotSize,
      }),
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
    const changed = [ 'description', 'shot_size', 'camera_move', 'dialogue' ].some(key => {
      if (key === 'shot_size') {
        return nextShotSize != null && String(nextShotSize) !== String(before.shot_size ?? '');
      }
      return payload[key] != null && String(payload[key]) !== String(before[key] ?? '');
    });
    if (changed || payload.positive_zh != null || payload.negative_zh != null) await this.markRevised(shot.id);
    return shot;
  }

  async removeShot(id) {
    const shot = await this.ctx.model.Shot.findByPk(id);
    if (!shot) this.ctx.throw(404, '镜头不存在');
    await this.destroyShotsByIds([ shot.id ]);
    return { id: Number(id) };
  }

  async ensureShotCodes(projectId) {
    try {
      const rows = await this.ctx.model.Shot.findAll({
        where: { project_id: projectId },
        order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      });
      let cursor = await this.maxShotCodeNum(projectId);
      for (const row of rows) {
        if (row.shot_code) continue;
        cursor += 1;
        await row.update({ shot_code: `S${String(cursor).padStart(6, '0')}` });
      }
    } catch (err) {
      this.ctx.logger.warn('[cartoon] ensureShotCodes %s', err.message);
    }
  }

  async savePanel(projectId, payload) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const type = contentType(project.content_type);
    if (!type?.panel?.length) this.ctx.throw(400, '这个类型没有面板');
    const stored = normalizePanel(type, payload);
    const fields = { payload: JSON.stringify(stored) };
    for (const key of LEGACY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(stored, key)) fields[key] = stored[key];
    }
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    if (row) await row.update(fields);
    else await this.ctx.model.TypePanel.create({ project_id: project.id, ...fields });
    return this.panelOf(project.id);
  }

  async panelOf(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const type = contentType(project.content_type);
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    return {
      content_type: project.content_type,
      label: type?.label || '',
      ready: await this.panelReady(project),
      fields: panelFields(type, row),
      panel: row,
    };
  }

  async panelReady(projectOrId) {
    const project = projectOrId && projectOrId.content_type
      ? projectOrId
      : await this.ctx.model.Project.findByPk(projectOrId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const type = contentType(project.content_type);
    if (!type?.panel?.length) return true;
    const row = await this.ctx.model.TypePanel.findOne({ where: { project_id: project.id } });
    return fieldsReady(type, row);
  }
}

module.exports = ProjectService;
