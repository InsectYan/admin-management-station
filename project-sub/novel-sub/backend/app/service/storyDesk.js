'use strict';

const Service = require('egg').Service;
const { formatDateTime } = require('../lib/formatDateTime');
const {
  hashBody,
  releaseState,
  releaseLabel,
  buildSnapshot,
  bannedIssues,
  nameIssues,
  plotlineIssues,
  normalizeScenes,
  scriptSuggestion,
  intentSuggestion,
  diffSnapshots,
  normalizeIntentShots,
  applySentence,
} = require('../lib/storySnapshot');
const { reportAudit } = require('../lib/reportAudit');
const { invokeSkill } = require('../lib/agentProxy');

function httpError(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  if (extra) Object.assign(err, extra);
  return err;
}

class StoryDeskService extends Service {
  packageIdOf(novelId) {
    return `pkg_${novelId}`;
  }

  async requireNovel(novelId) {
    const novel = await this.ctx.model.Novel.findByPk(novelId);
    if (!novel) throw httpError(404, '小说不存在');
    return novel;
  }

  async loadBodies(novelId) {
    const rows = await this.ctx.model.NovelChapterBody.findAll({ where: { novel_id: novelId } });
    return new Map(rows.map(row => [ row.chapter_id, row ]));
  }

  async loadTerms(novelId) {
    return this.ctx.model.NovelTerm.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async latestHashes(novelId) {
    const rows = await this.ctx.model.StoryPackage.findAll({
      where: { novel_id: novelId },
      order: [[ 'version', 'ASC' ]],
    });
    const map = new Map();
    for (const row of rows) {
      for (const chapter of row.snapshot_json?.chapters || []) {
        map.set(String(chapter.chapter_id), chapter.body_hash);
      }
    }
    return map;
  }

  chapterRows(novel, bodies, hashes) {
    const chapters = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    return chapters.map(chapter => {
      const body = bodies.get(chapter.id);
      const text = body?.body || '';
      const words = body ? Number(body.word_count) || 0 : 0;
      const state = releaseState(words, hashBody(text), hashes.get(chapter.id) || '');
      return {
        chapter_id: chapter.id,
        title: chapter.title,
        word_count: words,
        release_state: state,
        release_label: releaseLabel(state),
        body: text,
      };
    });
  }

  async overview(novelId) {
    const novel = await this.requireNovel(novelId);
    const [ bodies, hashes, versions, downstreams, videos, issues, promotions, terms ] = await Promise.all([
      this.loadBodies(novelId),
      this.latestHashes(novelId),
      this.ctx.model.StoryPackage.findAll({
        where: { novel_id: novelId },
        order: [[ 'version', 'DESC' ]],
      }),
      this.ctx.model.StoryDownstream.findAll({ where: { novel_id: novelId }, order: [[ 'id', 'DESC' ]] }),
      this.liveVideoProjects(),
      this.ctx.model.ConsistencyIssue.findAll({
        where: { novel_id: novelId, status: 'open' },
        order: [[ 'id', 'DESC' ]],
      }),
      this.ctx.model.StoryPromotion.findAll({
        where: { novel_id: novelId },
        order: [[ 'id', 'DESC' ]],
        limit: 50,
      }),
      this.loadTerms(novelId),
    ]);
    return {
      package_id: this.packageIdOf(novel.id),
      chapters: this.chapterRows(novel, bodies, hashes).map(({ body, ...rest }) => rest),
      versions: versions.map(row => ({
        version: row.version,
        published_at: formatDateTime(row.published_at),
        chapters: (row.snapshot_json?.chapters || []).map(item => ({
          chapter_id: item.chapter_id,
          title: item.title,
        })),
        scripts: (row.snapshot_json?.scripts || []).length,
        intent_shots: (row.snapshot_json?.intent_shots || []).length,
      })),
      downstreams: downstreams.map(row => {
        const live = videos.get(String(row.video_project_id));
        return {
          video_project_id: row.video_project_id,
          content_type: live?.content_type || row.content_type,
          version: row.version,
          name: live?.name || `视频项目 ${row.video_project_id}`,
          stage: live?.current_node || '',
          live: Boolean(live),
        };
      }),
      issues: issues.map(row => ({
        id: row.id,
        chapter_id: row.chapter_id,
        level: row.level,
        message: row.message,
        rule: row.rule,
      })),
      promotions: promotions.map(row => this.promotionView(row)),
      terms: terms.map(row => ({
        id: row.id,
        name: row.name,
        aliases: row.aliases || [],
        definition: row.definition || '',
        category: row.category,
        status: row.status,
      })),
    };
  }

  promotionView(row) {
    return {
      id: row.id,
      video_project_id: row.video_project_id,
      shot_id: row.shot_id,
      chapter_id: row.chapter_id,
      package_version: row.package_version,
      field: row.field,
      before: row.before_text,
      after: row.after_text,
      status: row.status,
      reason: row.reason || '',
      created_at: formatDateTime(row.created_at),
    };
  }

  async collectIssues(novel, chapterIds) {
    const terms = await this.loadTerms(novel.id);
    const bodies = await this.loadBodies(novel.id);
    const chapters = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    const wanted = new Set((chapterIds || []).map(String));
    const issues = [];
    for (const chapter of chapters) {
      if (wanted.size && !wanted.has(chapter.id)) continue;
      const text = `${chapter.title}\n${bodies.get(chapter.id)?.body || ''}`;
      issues.push(...bannedIssues(text, terms, chapter.id));
      issues.push(...nameIssues(text, novel, terms, chapter.id));
    }
    const plotlines = await this.ctx.model.Plotline.findAll({
      where: { novel_id: novel.id },
      order: [[ 'id', 'ASC' ]],
    });
    const plotChapters = chapters.map(chapter => ({
      id: chapter.id,
      order: chapter.order,
      written: String(bodies.get(chapter.id)?.body || '').trim().length > 0,
    }));
    const lineIssues = plotlineIssues(plotlines, plotChapters).filter(item => {
      if (!wanted.size) return true;
      return wanted.has(String(item.chapter_id || ''));
    });
    issues.push(...lineIssues);
    const scripts = await this.ctx.model.StoryScript.findAll({
      where: { novel_id: novel.id },
      order: [[ 'id', 'ASC' ]],
    });
    for (const script of scripts) {
      const chapterIds = Array.isArray(script.chapter_ids) ? script.chapter_ids.map(String) : [];
      const chapterId = chapterIds[0] || '';
      if (wanted.size && !chapterIds.some(id => wanted.has(id))) continue;
      const text = normalizeScenes(script.scenes).map(scene => [ scene.location, scene.characters, scene.dialogue, scene.action ].join('\n')).join('\n');
      issues.push(...bannedIssues(text, terms, chapterId));
      issues.push(...nameIssues(text, novel, terms, chapterId));
    }
    const intents = await this.ctx.model.StoryIntentShot.findAll({ where: { novel_id: novel.id } });
    for (const shot of intents) {
      const script = scripts.find(item => String(item.id) === String(shot.script_id));
      const chapterIds = Array.isArray(script?.chapter_ids) ? script.chapter_ids.map(String) : [];
      const chapterId = chapterIds[0] || '';
      if (wanted.size && !chapterIds.some(id => wanted.has(id))) continue;
      const text = [ shot.intent, shot.dialogue, shot.location ].join('\n');
      issues.push(...bannedIssues(text, terms, chapterId));
      issues.push(...nameIssues(text, novel, terms, chapterId));
    }
    return issues;
  }

  async replaceOpenIssues(novelId, issues) {
    const ignored = await this.ctx.model.ConsistencyIssue.findAll({
      where: { novel_id: novelId, status: 'ignored' },
    });
    const ignoredKeys = new Set(ignored.map(row => `${row.chapter_id}|${row.rule}|${row.message}`));
    const fresh = issues.filter(item => !ignoredKeys.has(`${item.chapter_id}|${item.rule}|${item.message}`));
    await this.ctx.model.ConsistencyIssue.destroy({ where: { novel_id: novelId, status: 'open' } });
    if (fresh.length) {
      await this.ctx.model.ConsistencyIssue.bulkCreate(fresh.map(item => ({
        novel_id: novelId,
        chapter_id: item.chapter_id,
        rule: item.rule,
        level: item.level,
        status: 'open',
        message: item.message,
        source: item.source || 'rule',
      })));
    }
    return fresh;
  }

  async runConsistency(novelId, chapterIds) {
    const novel = await this.requireNovel(novelId);
    const issues = await this.collectIssues(novel, chapterIds);
    const saved = await this.replaceOpenIssues(novelId, issues);
    return {
      blocks: saved.filter(item => item.level === 'block'),
      issues: saved,
    };
  }

  async publish(novelId, chapterIds, scriptIds, intentIds) {
    const novel = await this.requireNovel(novelId);
    const ids = [ ...new Set((chapterIds || []).map(id => String(id || '').trim()).filter(Boolean)) ];
    if (!ids.length) throw httpError(400, '请选择要发布的章节');
    const check = await this.runConsistency(novelId, ids);
    if (check.blocks.length) {
      throw httpError(400, '有禁用词未处理，故事包没有发布', { issues: check.blocks });
    }
    const bodies = await this.loadBodies(novelId);
    const catalog = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    const byId = new Map(catalog.map(item => [ item.id, item ]));
    const selected = [];
    for (const id of ids) {
      const meta = byId.get(id);
      if (!meta) throw httpError(404, '章节不存在');
      const text = String(bodies.get(id)?.body || '').trim();
      if (!text) throw httpError(400, `「${meta.title}」还没有正文`);
      selected.push({ chapter_id: id, title: meta.title, body: bodies.get(id).body });
    }
    const terms = await this.loadTerms(novelId);
    const scripts = await this.scriptsForPublish(novelId, scriptIds, ids);
    const intentShots = await this.intentsForPublish(novelId, intentIds, scripts);
    const snapshot = buildSnapshot({ novel, chapters: selected, terms, scripts, intentShots });
    const latest = await this.ctx.model.StoryPackage.max('version', { where: { novel_id: novelId } });
    const version = (Number.isFinite(latest) ? latest : 0) + 1;
    snapshot.version = version;
    snapshot.published_at = new Date().toISOString();
    const row = await this.ctx.model.StoryPackage.create({
      novel_id: novelId,
      package_id: snapshot.package_id,
      version,
      snapshot_json: snapshot,
      published_at: new Date(),
    });
    await reportAudit(this.ctx, {
      action: 'story.publish',
      external_id: row.package_id,
      detail: { version, chapter_ids: ids },
    });
    return {
      package_id: row.package_id,
      version: row.version,
      published_at: formatDateTime(row.published_at),
      chapters: snapshot.chapters.map(item => ({ chapter_id: item.chapter_id, title: item.title })),
    };
  }

  async comparePackages(novelId, fromVersion, toVersion) {
    await this.requireNovel(novelId);
    const from = Number(fromVersion);
    const to = Number(toVersion);
    if (!from || !to) throw httpError(400, '请选择两个版本');
    if (from === to) throw httpError(400, '请选择两个不同的版本');
    const [ left, right ] = await Promise.all([
      this.ctx.model.StoryPackage.findOne({ where: { novel_id: novelId, version: from } }),
      this.ctx.model.StoryPackage.findOne({ where: { novel_id: novelId, version: to } }),
    ]);
    if (!left || !right) throw httpError(404, '故事包版本不存在');
    return diffSnapshots(
      { ...left.snapshot_json, version: left.version },
      { ...right.snapshot_json, version: right.version },
    );
  }

  async readPackage(packageId, version) {
    const where = { package_id: String(packageId || '') };
    if (version) where.version = Number(version);
    const row = await this.ctx.model.StoryPackage.findOne({
      where,
      order: [[ 'version', 'DESC' ]],
    });
    if (!row) throw httpError(404, '故事包不存在');
    return {
      ...row.snapshot_json,
      package_id: row.package_id,
      version: row.version,
      published_at: formatDateTime(row.published_at),
    };
  }

  async saveTerm(novelId, payload) {
    await this.requireNovel(novelId);
    const name = String(payload.name || '').trim();
    if (!name) throw httpError(400, '术语名称不能为空');
    const aliases = String(payload.aliases || '')
      .split(/[,，]/)
      .map(item => item.trim())
      .filter(Boolean);
    const category = [ 'term', 'banned', 'proper' ].includes(payload.category) ? payload.category : 'term';
    return this.ctx.model.NovelTerm.create({
      novel_id: novelId,
      name,
      aliases,
      definition: payload.definition || '',
      category,
      status: 'active',
    });
  }

  async removeTerm(novelId, termId) {
    const row = await this.ctx.model.NovelTerm.findOne({ where: { id: termId, novel_id: novelId } });
    if (!row) throw httpError(404, '术语不存在');
    await row.destroy();
    return true;
  }

  async createPromotion(payload) {
    const novelId = Number(payload.narrative_project_id);
    const novel = await this.requireNovel(novelId);
    const before = String(payload.before || '');
    const after = String(payload.after || '');
    if (!before.trim() || !after.trim()) throw httpError(400, '原句和改后的句子都要填写');
    const chapterId = String(payload.chapter_id || '');
    const chapters = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    if (!chapters.some(item => item.id === chapterId)) throw httpError(404, '章节不存在');
    if (payload.package_version) {
      const pack = await this.ctx.model.StoryPackage.findOne({
        where: { novel_id: novelId, version: Number(payload.package_version) },
      });
      const chapter = (pack?.snapshot_json?.chapters || []).find(item => item.chapter_id === chapterId);
      if (!chapter || !String(chapter.body || '').includes(before)) {
        throw httpError(409, '原句不在所钉扎的故事包版本里');
      }
    }
    const row = await this.ctx.model.StoryPromotion.create({
      novel_id: novelId,
      video_project_id: String(payload.video_project_id || ''),
      shot_id: String(payload.shot_id || ''),
      chapter_id: chapterId,
      package_version: payload.package_version ? Number(payload.package_version) : null,
      field: payload.field || 'dialogue',
      before_text: before,
      after_text: after,
      operator_id: payload.operator_id || '',
      status: 'pending',
    });
    return this.promotionView(row);
  }

  async applyPromotion(novelId, promotionId) {
    const row = await this.ctx.model.StoryPromotion.findOne({
      where: { id: promotionId, novel_id: novelId },
    });
    if (!row) throw httpError(404, '提升申请不存在');
    if (row.status !== 'pending') throw httpError(400, '这份申请已经处理过');
    const current = await this.ctx.service.novel.getChapterBody(novelId, row.chapter_id);
    const next = applySentence(current?.body || '', row.before_text, row.after_text);
    await this.ctx.service.novel.upsertChapterBody(novelId, row.chapter_id, next);
    await row.update({ status: 'applied' });
    await reportAudit(this.ctx, {
      action: 'story.promotion.apply',
      external_id: row.id,
      detail: { novel_id: Number(novelId), chapter_id: row.chapter_id, video_project_id: row.video_project_id },
    });
    return this.promotionView(row);
  }

  async rejectPromotion(novelId, promotionId, reason) {
    const row = await this.ctx.model.StoryPromotion.findOne({
      where: { id: promotionId, novel_id: novelId },
    });
    if (!row) throw httpError(404, '提升申请不存在');
    if (row.status !== 'pending') throw httpError(400, '这份申请已经处理过');
    const text = String(reason || '').trim();
    if (!text) throw httpError(400, '请填写驳回理由');
    await row.update({ status: 'rejected', reason: text });
    await reportAudit(this.ctx, {
      action: 'story.promotion.reject',
      external_id: row.id,
      detail: { novel_id: Number(novelId), chapter_id: row.chapter_id, reason: text },
    });
    return this.promotionView(row);
  }

  async cartoonFetch(path, headers) {
    const configured = String(this.config.cartoon?.baseUrl || 'http://127.0.0.1:5205').replace(/\/$/, '');
    const bases = [ configured ];
    if (/127\.0\.0\.1|localhost/.test(configured)) {
      bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
    }
    let last = new Error('无法连接视频');
    for (const base of bases) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers,
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          last = new Error(`HTTP ${res.status}`);
          continue;
        }
        return res;
      } catch (err) {
        last = err;
      }
    }
    throw last;
  }

  async liveVideoProjects() {
    const token = this.config.cartoon?.opsToken || 'ops-internal-dev';
    try {
      const res = await this.cartoonFetch('/api/internal/ops/projects', { 'X-Ops-Token': token });
      const json = await res.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      return new Map(rows.map(row => [ String(row.id), row ]));
    } catch (err) {
      this.ctx.logger.warn('[story] video projects %s', err.message);
      return new Map();
    }
  }

  async saveDownstream(payload) {
    const novelId = Number(payload.narrative_project_id);
    await this.requireNovel(novelId);
    const videoProjectId = String(payload.video_project_id || '');
    if (!videoProjectId) throw httpError(400, '缺少视频项目');
    const values = {
      novel_id: novelId,
      package_id: String(payload.package_id || this.packageIdOf(novelId)),
      version: Number(payload.version) || 0,
      video_project_id: videoProjectId,
      content_type: payload.content_type || 'ai_comic',
    };
    const existing = await this.ctx.model.StoryDownstream.findOne({ where: { video_project_id: videoProjectId } });
    if (existing) {
      await existing.update(values);
      return existing;
    }
    return this.ctx.model.StoryDownstream.create(values);
  }

  async opsSummary() {
    const [ packages, pending, openIssues ] = await Promise.all([
      this.ctx.model.StoryPackage.count(),
      this.ctx.model.StoryPromotion.count({ where: { status: 'pending' } }),
      this.ctx.model.ConsistencyIssue.count({ where: { status: 'open' } }),
    ]);
    return {
      biz_app: 'narrative',
      package_count: packages,
      pending_promotions: pending,
      open_issues: openIssues,
    };
  }

  async opsTasks(query) {
    const novels = await this.ctx.model.Novel.findAll({ attributes: [ 'id', 'title' ] });
    const titles = new Map(novels.map(row => [ row.id, row.title ]));
    const promotions = await this.ctx.model.StoryPromotion.findAll({ order: [[ 'id', 'DESC' ]], limit: 100 });
    const issues = await this.ctx.model.ConsistencyIssue.findAll({
      where: { status: 'open' },
      order: [[ 'id', 'DESC' ]],
      limit: 100,
    });
    let list = [
      ...promotions.map(row => ({
        id: `p-${row.id}`,
        project_id: row.novel_id,
        project_name: titles.get(row.novel_id) || '',
        kind: 'promotion',
        status: row.status === 'applied' ? 'success' : (row.status === 'rejected' ? 'cancelled' : 'queued'),
        error_message: '',
        retryable: false,
        cancellable: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      ...issues.map(row => ({
        id: `c-${row.id}`,
        project_id: row.novel_id,
        project_name: titles.get(row.novel_id) || '',
        kind: 'consistency',
        status: 'queued',
        error_message: String(row.rule || ''),
        retryable: false,
        cancellable: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    ];
    if (query.project_id) list = list.filter(item => String(item.project_id) === String(query.project_id));
    if (query.status) list = list.filter(item => item.status === String(query.status));
    const total = list.length;
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = Math.max(0, Number(query.offset) || 0);
    return { list: list.slice(offset, offset + limit), total, limit, offset };
  }

  async opsTask(id) {
    const view = await this.opsTasks({ limit: 100 });
    const row = view.list.find(item => item.id === String(id));
    if (!row) {
      const err = new Error('任务不存在');
      err.status = 404;
      throw err;
    }
    return row;
  }

  async recordExport(novelId, payload) {
    await this.requireNovel(novelId);
    const format = [ 'md', 'txt', 'doc' ].includes(payload.format) ? payload.format : '';
    if (!format) throw httpError(400, '需要导出格式');
    await reportAudit(this.ctx, {
      action: 'story.export',
      external_id: novelId,
      detail: {
        format,
        version: payload.version ? Number(payload.version) : null,
      },
    });
    return { format };
  }

  plotlineView(row) {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      plant_chapter_id: row.plant_chapter_id || '',
      payoff_chapter_id: row.payoff_chapter_id || '',
      events: Array.isArray(row.events) ? row.events : [],
    };
  }

  normalizeEvents(events) {
    if (!Array.isArray(events)) return [];
    const seen = new Set();
    const out = [];
    for (const event of events) {
      const chapterId = String(event?.chapter_id || '').trim();
      if (!chapterId || seen.has(chapterId)) continue;
      seen.add(chapterId);
      out.push({ chapter_id: chapterId, summary: String(event?.summary || '').trim() });
    }
    return out;
  }

  async listPlotlines(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.Plotline.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(row => this.plotlineView(row));
  }

  async savePlotline(novelId, plotlineId, payload) {
    await this.requireNovel(novelId);
    const name = String(payload.name || '').trim();
    if (!name) throw httpError(400, '需要剧情线名称');
    const kinds = [ 'main', 'side', 'foreshadow', 'emotion' ];
    const statuses = [ 'open', 'active', 'resolved', 'dropped' ];
    const fields = {
      name,
      kind: kinds.includes(payload.kind) ? payload.kind : 'main',
      status: statuses.includes(payload.status) ? payload.status : 'open',
      plant_chapter_id: String(payload.plant_chapter_id || ''),
      payoff_chapter_id: String(payload.payoff_chapter_id || ''),
      events: this.normalizeEvents(payload.events),
    };
    if (plotlineId) {
      const row = await this.ctx.model.Plotline.findOne({
        where: { id: plotlineId, novel_id: novelId },
      });
      if (!row) throw httpError(404, '剧情线不存在');
      await row.update(fields);
      return this.plotlineView(row);
    }
    const row = await this.ctx.model.Plotline.create({ novel_id: novelId, ...fields });
    return this.plotlineView(row);
  }

  async removePlotline(novelId, plotlineId) {
    const row = await this.ctx.model.Plotline.findOne({
      where: { id: plotlineId, novel_id: novelId },
    });
    if (!row) throw httpError(404, '剧情线不存在');
    await row.destroy();
  }

  async bindChapterPlotlines(novelId, chapterId, plotlineIds) {
    const novel = await this.requireNovel(novelId);
    const chapter = String(chapterId || '').trim();
    const known = this.ctx.service.novel.listSettingChapters(novel.setting_json);
    if (!known.some(item => item.id === chapter)) throw httpError(404, '章节不存在');
    const wanted = new Set((plotlineIds || []).map(id => String(id)));
    const rows = await this.ctx.model.Plotline.findAll({ where: { novel_id: novelId } });
    for (const row of rows) {
      const events = this.normalizeEvents(row.events);
      const has = events.some(event => event.chapter_id === chapter);
      const should = wanted.has(String(row.id));
      if (should === has) continue;
      const next = should
        ? events.concat([{ chapter_id: chapter, summary: '' }])
        : events.filter(event => event.chapter_id !== chapter);
      await row.update({ events: next });
    }
    return this.listPlotlines(novelId);
  }

  scriptView(row) {
    return {
      id: row.id,
      title: row.title,
      variant: row.variant,
      chapter_ids: Array.isArray(row.chapter_ids) ? row.chapter_ids : [],
      scenes: normalizeScenes(row.scenes),
    };
  }

  async listScripts(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StoryScript.findAll({
      where: { novel_id: novelId },
      order: [[ 'id', 'ASC' ]],
    });
    return rows.map(row => this.scriptView(row));
  }

  async suggestScript(novelId, payload) {
    const novel = await this.requireNovel(novelId);
    const chapterIds = [ ...new Set((payload.chapter_ids || []).map(id => String(id || '').trim()).filter(Boolean)) ];
    if (!chapterIds.length) throw httpError(400, '先选择章节');
    const known = new Set(this.ctx.service.novel.listSettingChapters(novel.setting_json).map(item => item.id));
    if (chapterIds.some(id => !known.has(id))) throw httpError(400, '剧本里有不存在的章节');
    const chapters = [];
    for (const id of chapterIds) {
      const current = await this.ctx.service.novel.getChapterBody(novelId, id);
      const body = String(current?.body || '').trim();
      if (!body) throw httpError(400, '所选章节还没有正文');
      chapters.push({
        chapter_id: id,
        title: current.chapter?.title || '',
        body: body.slice(0, 4000),
      });
    }
    const characters = (novel.setting_json?.characters || []).map(item => ({
      name: item.name || '',
      appearance: item.appearance || '',
    })).filter(item => item.name);
    const variant = payload.variant === 'short_drama' ? 'short_drama' : 'comic';
    let invoked;
    try {
      invoked = await invokeSkill(this.ctx, {
        skill: 'novel-writer-skill',
        action: 'fill_script',
        payload: {
          user_message: String(payload.user_message || '').trim() || '根据所选章节正文整理成剧本建议',
          target_fields: [ 'script' ],
          variant,
          bound_context: { chapters, characters, variant },
        },
      });
    } catch (err) {
      throw httpError(err.status || 503, err.message || '剧本建议没有生成');
    }
    const envelope = invoked.data && typeof invoked.data === 'object' ? invoked.data : {};
    const output = envelope.output && typeof envelope.output === 'object' ? envelope.output : envelope;
    const patch = output.patch && typeof output.patch === 'object' ? output.patch : {};
    const suggestion = scriptSuggestion({
      reply: output.reply || envelope.reply || '',
      script: patch.script || patch,
    }, {
      variant,
      chapter_ids: chapterIds,
      title: chapters[0]?.title ? `${chapters[0].title}剧本` : '',
    });
    if (!suggestion.scenes.length) throw httpError(502, '没有得到可用的剧本建议');
    return suggestion;
  }

  async saveScript(novelId, scriptId, payload) {
    const novel = await this.requireNovel(novelId);
    const title = String(payload.title || '').trim();
    if (!title) throw httpError(400, '需要剧本标题');
    const variants = [ 'comic', 'short_drama' ];
    const known = new Set(this.ctx.service.novel.listSettingChapters(novel.setting_json).map(item => item.id));
    const chapterIds = [ ...new Set((payload.chapter_ids || []).map(id => String(id || '').trim()).filter(Boolean)) ];
    if (chapterIds.some(id => !known.has(id))) throw httpError(400, '剧本里有不存在的章节');
    const fields = {
      title,
      variant: variants.includes(payload.variant) ? payload.variant : 'comic',
      chapter_ids: chapterIds,
      scenes: normalizeScenes(payload.scenes),
    };
    if (scriptId) {
      const row = await this.ctx.model.StoryScript.findOne({ where: { id: scriptId, novel_id: novelId } });
      if (!row) throw httpError(404, '剧本不存在');
      await row.update(fields);
      return this.scriptView(row);
    }
    const row = await this.ctx.model.StoryScript.create({ novel_id: novelId, ...fields });
    return this.scriptView(row);
  }

  async removeScript(novelId, scriptId) {
    const row = await this.ctx.model.StoryScript.findOne({ where: { id: scriptId, novel_id: novelId } });
    if (!row) throw httpError(404, '剧本不存在');
    await row.destroy();
  }

  async scriptsForPublish(novelId, scriptIds, chapterIds) {
    const wanted = [ ...new Set((scriptIds || []).map(id => String(id || '').trim()).filter(Boolean)) ];
    if (!wanted.length) return [];
    const rows = await this.ctx.model.StoryScript.findAll({ where: { novel_id: novelId } });
    const byId = new Map(rows.map(row => [ String(row.id), row ]));
    const selectedChapters = new Set(chapterIds);
    const picked = [];
    for (const id of wanted) {
      const row = byId.get(id);
      if (!row) throw httpError(404, '剧本不存在');
      const covered = (row.chapter_ids || []).map(String).some(chapterId => selectedChapters.has(chapterId));
      if (!covered) throw httpError(400, `「${row.title}」不在这次发布的章节里`);
      picked.push(row);
    }
    return picked;
  }

  intentView(row, video) {
    return {
      id: row.id,
      intent_id: String(row.id),
      script_id: row.script_id,
      sort_order: row.sort_order,
      scene_order: row.scene_order,
      intent: row.intent || '',
      dialogue: row.dialogue || '',
      emotion: row.emotion || '',
      location: row.location || '',
      character_ids: Array.isArray(row.character_ids) ? row.character_ids : [],
      video: video || null,
    };
  }

  async listIntentShots(novelId) {
    await this.requireNovel(novelId);
    const rows = await this.ctx.model.StoryIntentShot.findAll({
      where: { novel_id: novelId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
    const links = await this.intentVideoLinks(novelId);
    return rows.map(row => this.intentView(row, links.get(String(row.id)) || null));
  }

  async suggestIntentShots(novelId, payload) {
    const novel = await this.requireNovel(novelId);
    const scriptId = Number(payload.script_id);
    if (!scriptId) throw httpError(400, '先选择剧本');
    const script = await this.ctx.model.StoryScript.findOne({ where: { id: scriptId, novel_id: novelId } });
    if (!script) throw httpError(404, '剧本不存在');
    const scenes = normalizeScenes(script.scenes);
    if (!scenes.length) throw httpError(400, '这份剧本还没有场次');
    const characters = (novel.setting_json?.characters || []).map(item => ({
      id: String(item.id || ''),
      name: item.name || '',
    })).filter(item => item.id && item.name);
    let invoked;
    try {
      invoked = await invokeSkill(this.ctx, {
        skill: 'novel-writer-skill',
        action: 'fill_intent_shots',
        payload: {
          user_message: String(payload.user_message || '').trim() || '根据剧本场次整理成叙事分镜建议',
          target_fields: [ 'intent_shots' ],
          bound_context: {
            script: { id: script.id, title: script.title, scenes },
            characters,
          },
        },
      });
    } catch (err) {
      throw httpError(err.status || 503, err.message || '叙事分镜建议没有生成');
    }
    const envelope = invoked.data && typeof invoked.data === 'object' ? invoked.data : {};
    const output = envelope.output && typeof envelope.output === 'object' ? envelope.output : envelope;
    const patch = output.patch && typeof output.patch === 'object' ? output.patch : {};
    const suggestion = intentSuggestion({
      reply: output.reply || envelope.reply || '',
      intent_shots: patch.intent_shots || patch.shots || [],
    }, { script_id: scriptId, characters });
    if (!suggestion.shots.length) throw httpError(502, '没有得到可用的叙事分镜建议');
    return suggestion;
  }

  async intentVideoLinks(novelId) {
    const links = new Map();
    const downstreams = await this.ctx.model.StoryDownstream.findAll({ where: { novel_id: novelId } });
    if (!downstreams.length) return links;
    for (const row of downstreams) {
      try {
        const res = await this.cartoonFetch(`/api/projects/${encodeURIComponent(row.video_project_id)}`);
        const json = await res.json().catch(() => ({}));
        const shots = json.data?.shots || [];
        for (const shot of shots) {
          const intentId = String(shot.upstream_intent_id || '');
          if (!intentId || links.has(intentId)) continue;
          links.set(intentId, {
            project_id: String(row.video_project_id),
            shot_id: shot.id,
            task_id: shot.video_task_id || null,
          });
        }
      } catch (err) {
        this.ctx.logger.warn('[story] intent link %s', err.message);
      }
    }
    return links;
  }

  async saveIntentShot(novelId, shotId, payload) {
    await this.requireNovel(novelId);
    const intent = String(payload.intent || '').trim();
    const dialogue = String(payload.dialogue || '').trim();
    const location = String(payload.location || '').trim();
    if (!intent && !dialogue && !location) throw httpError(400, '需要意图、台词或地点');
    let scriptId = payload.script_id ? Number(payload.script_id) : null;
    if (scriptId) {
      const script = await this.ctx.model.StoryScript.findOne({ where: { id: scriptId, novel_id: novelId } });
      if (!script) throw httpError(404, '剧本不存在');
    } else {
      scriptId = null;
    }
    const fields = {
      script_id: scriptId,
      sort_order: Number(payload.sort_order) || 1,
      scene_order: Number(payload.scene_order) || 0,
      intent,
      dialogue,
      emotion: String(payload.emotion || '').trim(),
      location,
      character_ids: Array.isArray(payload.character_ids) ? payload.character_ids.map(id => String(id)) : [],
    };
    if (shotId) {
      const row = await this.ctx.model.StoryIntentShot.findOne({ where: { id: shotId, novel_id: novelId } });
      if (!row) throw httpError(404, '叙事分镜不存在');
      await row.update(fields);
      return this.intentView(row);
    }
    const row = await this.ctx.model.StoryIntentShot.create({ novel_id: novelId, ...fields });
    return this.intentView(row);
  }

  async removeIntentShot(novelId, shotId) {
    const row = await this.ctx.model.StoryIntentShot.findOne({ where: { id: shotId, novel_id: novelId } });
    if (!row) throw httpError(404, '叙事分镜不存在');
    await row.destroy();
  }

  async intentsForPublish(novelId, intentIds, scripts) {
    const wanted = [ ...new Set((intentIds || []).map(id => String(id || '').trim()).filter(Boolean)) ];
    if (!wanted.length) return [];
    const scriptIds = new Set((scripts || []).map(row => String(row.id)));
    const rows = await this.ctx.model.StoryIntentShot.findAll({ where: { novel_id: novelId } });
    const byId = new Map(rows.map(row => [ String(row.id), row ]));
    const picked = [];
    for (const id of wanted) {
      const row = byId.get(id);
      if (!row) throw httpError(404, '叙事分镜不存在');
      if (!row.script_id || !scriptIds.has(String(row.script_id))) {
        throw httpError(400, '叙事分镜所属剧本不在这次发布里');
      }
      picked.push(row);
    }
    return picked;
  }
}

module.exports = StoryDeskService;
