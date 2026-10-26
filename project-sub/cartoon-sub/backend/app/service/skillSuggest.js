'use strict';

const { Op } = require('sequelize');
const Service = require('egg').Service;
const { invokeSkill, listMediaProfiles } = require('../lib/agentProxy');
const { present } = require('../lib/pipelineDefaults');
const { profileEnabled } = require('../lib/modelGate');
const { productionInput } = require('../lib/productionInput');
const { reportAudit } = require('../lib/reportAudit');

const REVIEW_NODES = [ 'script', 'storyboard', 'generate', 'voice', 'compose' ];

function rowsOf(list) {
  return (list || []).map(item => (item.toJSON ? item.toJSON() : item));
}

class SkillSuggestService extends Service {
  async project(projectId) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    return project;
  }

  async pipelineView(contentType) {
    const [ nodes, agents ] = await Promise.all([
      this.ctx.model.PipelineNode.findAll({ where: { content_type: contentType } }),
      this.ctx.model.AgentConfig.findAll({ where: { content_type: contentType } }),
    ]);
    return present(contentType, rowsOf(nodes), rowsOf(agents));
  }

  source(project, payload) {
    return productionInput(project, { copy_block_id: payload.copy_block_id });
  }

  async gate(project, role, nodeKey) {
    const view = await this.pipelineView(project.content_type);
    const node = view.nodes.find(item => item.node_key === nodeKey);
    if (nodeKey) {
      const titles = { voice: '配音', review: '初审', subtitle: '字幕' };
      if (!node?.enabled) this.ctx.throw(400, `${titles[nodeKey] || '这个'}节点未启用`);
    }
    const agent = view.agents.find(item => item.role === role);
    if (!agent?.enabled || !agent.model_profile) this.ctx.throw(400, '没有可用档位，不能调用');
    const enabled = await profileEnabled(this.ctx, agent.model_profile);
    if (enabled !== true) this.ctx.throw(400, '没有可用档位，不能调用');
    return agent;
  }

  async callSkill(project, agent, payload) {
    const started = Date.now();
    let lastError = null;
    const tries = Math.max(0, Number(agent.retry_count) || 0) + 1;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      try {
        const result = await invokeSkill(this.ctx, {
          skill: agent.skill_name,
          action: payload.action,
          payload,
        });
        await reportAudit(this.ctx, {
          action: 'video.skill.invoke',
          external_id: project.id,
          detail: {
            skill: agent.skill_name,
            model_profile: agent.model_profile,
            duration_ms: Date.now() - started,
            success: true,
            project_id: project.id,
            package_version: project.package_version || null,
          },
        });
        return result;
      } catch (err) {
        lastError = err;
        if (err.status && err.status < 500) break;
      }
    }
    await reportAudit(this.ctx, {
      action: 'video.skill.invoke',
      external_id: project.id,
      detail: {
        skill: agent.skill_name,
        model_profile: agent.model_profile,
        duration_ms: Date.now() - started,
        success: false,
        project_id: project.id,
        package_version: project.package_version || null,
      },
    });
    this.ctx.throw(lastError?.status || 502, lastError?.message || '技能没有返回结果');
  }

  async shots(projectId) {
    return this.ctx.model.Shot.findAll({
      where: { project_id: projectId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });
  }

  async matchAssets(projectId) {
    const project = await this.project(projectId);
    const [ shots, assets ] = await Promise.all([
      this.shots(project.id),
      this.ctx.model.Asset.findAll({ where: { project_id: project.id, disabled: false } }),
    ]);
    const bindings = [];
    for (const shot of shots) {
      const text = `${shot.description || ''}\n${shot.dialogue || ''}`;
      const hit = assets
        .filter(asset => asset.name && text.includes(asset.name))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (!hit) continue;
      bindings.push({ shot_id: shot.id, asset_id: hit.id, reason: '名称出现在镜头里' });
    }
    await this.ctx.model.ShotBinding.destroy({ where: { project_id: project.id } });
    if (bindings.length) {
      await this.ctx.model.ShotBinding.bulkCreate(bindings.map(item => ({ project_id: project.id, ...item })));
    }
    return this.bindings(project.id);
  }

  async suggestAssets(projectId) {
    const project = await this.project(projectId);
    const agent = await this.gate(project, 'asset');
    const [ shots, assets ] = await Promise.all([
      this.shots(project.id),
      this.ctx.model.Asset.findAll({ where: { project_id: project.id, disabled: false } }),
    ]);
    if (!shots.length || !assets.length) this.ctx.throw(400, '需要镜头和资产');
    const result = await this.callSkill(project, agent, {
      action: 'suggest',
      ...this.source(project, {}),
      model_profile: agent.model_profile,
      shots: shots.map(item => ({ id: item.id, description: item.description, dialogue: item.dialogue })),
      assets: assets.map(item => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        scene_type: item.scene_type,
        prop_category: item.prop_category,
        voice_key: item.voice_key,
      })),
    });
    const suggestions = result.output?.suggestions || [];
    return { suggestions, persisted: false };
  }

  async applyAssets(projectId, payload) {
    const project = await this.project(projectId);
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    if (!suggestions.length) this.ctx.throw(400, '没有可写入的建议');
    const [ shots, assets ] = await Promise.all([
      this.shots(project.id),
      this.ctx.model.Asset.findAll({ where: { project_id: project.id, disabled: false } }),
    ]);
    const shotIds = new Set(shots.map(item => String(item.id)));
    const assetIds = new Set(assets.map(item => String(item.id)));
    const bindings = suggestions.map(item => {
      if (!shotIds.has(String(item.shot_id)) || !assetIds.has(String(item.asset_id))) {
        this.ctx.throw(400, '资产不在可选范围');
      }
      return {
        shot_id: Number(item.shot_id),
        asset_id: Number(item.asset_id),
        reason: String(item.reason || '').slice(0, 80),
      };
    });
    await this.replaceBindings(project.id, bindings);
    return this.bindings(project.id);
  }

  async replaceBindings(projectId, bindings) {
    const shotIds = [ ...new Set(bindings.map(item => item.shot_id)) ];
    if (shotIds.length) {
      await this.ctx.model.ShotBinding.destroy({ where: { project_id: projectId, shot_id: { [Op.in]: shotIds } } });
    }
    if (bindings.length) {
      await this.ctx.model.ShotBinding.bulkCreate(bindings.map(item => ({ project_id: projectId, ...item })));
    }
  }

  async bindings(projectId) {
    return this.ctx.model.ShotBinding.findAll({
      where: { project_id: projectId },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async suggestVoice(projectId) {
    const project = await this.project(projectId);
    const agent = await this.gate(project, 'voice', 'voice');
    const voice = await this.ctx.model.Asset.findOne({
      where: { project_id: project.id, kind: 'voice', disabled: false },
      order: [[ 'id', 'ASC' ]],
    });
    if (!voice?.voice_key) this.ctx.throw(400, '需要音色标识');
    const shots = await this.shots(project.id);
    const spoken = shots.filter(item => String(item.dialogue || '').trim());
    if (!spoken.length) this.ctx.throw(400, '需要镜头台词');
    const result = await this.callSkill(project, agent, {
      action: 'draft_timeline',
      ...this.source(project, {}),
      model_profile: agent.model_profile,
      voice_key: voice.voice_key,
      voice: {
        voice_key: voice.voice_key,
        speech_rate: voice.speech_rate,
        emotion: voice.emotion,
        voice_lang: voice.voice_lang,
        speaker_name: voice.speaker_name,
      },
      shots: spoken.map(item => ({
        id: item.id,
        dialogue: item.dialogue,
        duration_ms: item.duration_ms,
        emotion: item.emotion,
      })),
    });
    return { cues: result.output?.cues || [], persisted: false };
  }

  async applyVoice(projectId, payload) {
    const project = await this.project(projectId);
    const cues = Array.isArray(payload.cues) ? payload.cues : [];
    if (!cues.length) this.ctx.throw(400, '没有可写入的时间轴');
    const [ shots, voices ] = await Promise.all([
      this.shots(project.id),
      this.ctx.model.Asset.findAll({ where: { project_id: project.id, kind: 'voice', disabled: false } }),
    ]);
    const shotById = new Map(shots.map(item => [ String(item.id), item ]));
    const keys = new Set(voices.map(item => item.voice_key).filter(Boolean));
    const next = [];
    const spans = [];
    for (const item of cues) {
      const shot = shotById.get(String(item.shot_id));
      if (!shot) this.ctx.throw(400, '镜头不存在');
      if (!keys.has(String(item.voice_key || ''))) this.ctx.throw(400, '需要音色标识');
      const duration = Number(shot.duration_ms) > 0 ? Number(shot.duration_ms) : 3000;
      const start = Number(item.start_ms);
      const end = Number(item.end_ms);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > duration || end <= start) {
        this.ctx.throw(400, '时间轴超出镜头');
      }
      if (spans.some(row => row.shot_id === shot.id && start < row.end && end > row.start)) {
        this.ctx.throw(400, '时间轴超出镜头');
      }
      spans.push({ shot_id: shot.id, start, end });
      next.push({
        shot_id: shot.id,
        text: String(shot.dialogue || item.text || '').slice(0, 500),
        start_ms: start,
        end_ms: end,
        voice_key: String(item.voice_key),
        media_ref: String(item.media_ref || '').slice(0, 200),
      });
    }
    const shotIds = [ ...new Set(next.map(item => item.shot_id)) ];
    await this.ctx.model.VoiceCue.destroy({ where: { project_id: project.id, shot_id: { [Op.in]: shotIds } } });
    await this.ctx.model.VoiceCue.bulkCreate(next.map(item => ({ project_id: project.id, ...item })));
    const saved = await this.voiceCues(project.id);
    if (!payload.request_audio) return { cues: saved, audio_note: '' };
    const audioNote = await this.fillAudio(saved);
    return { cues: await this.voiceCues(project.id), audio_note: audioNote };
  }

  async fillAudio(cues) {
    const profiles = await listMediaProfiles(this.ctx);
    const audio = profiles.find(item => Array.isArray(item.modalities) && item.modalities.includes('audio') && item.generateReady);
    if (!audio) return '当前档位不能出音频';
    const base = String(this.ctx.app.config.agentPlatform?.baseUrl || '').replace(/\/$/, '');
    for (const cue of cues) {
      const res = await fetch(`${base}/api/media/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'audio',
          prompt: cue.text,
          media_profile: audio.id,
        }),
        signal: AbortSignal.timeout(180000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) this.ctx.throw(res.status >= 500 ? 502 : res.status, data.error || '音频没有生成');
      const mediaRef = String(data.url || data.file || data.id || '').slice(0, 200);
      if (mediaRef) await this.ctx.model.VoiceCue.update({ media_ref: mediaRef }, { where: { id: cue.id } });
    }
    return '';
  }

  async voiceCues(projectId) {
    return this.ctx.model.VoiceCue.findAll({ where: { project_id: projectId }, order: [[ 'id', 'ASC' ]] });
  }

  async loadRules() {
    const configured = String(this.ctx.app.config.ops?.baseUrl || 'http://127.0.0.1:5203').replace(/\/$/, '');
    const bases = [ configured ];
    if (/127\.0\.0\.1|localhost/.test(configured)) bases.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
    const token = this.ctx.app.config.ops?.internalToken || process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/internal/compliance/rules`, {
          headers: { 'X-Ops-Token': token },
          signal: AbortSignal.timeout(2500),
        });
        if (!res.ok) continue;
        const json = await res.json();
        return json.data || null;
      } catch (err) {
        this.ctx.logger.warn('[review-rules] %s', err.message);
      }
    }
    return null;
  }

  async suggestReview(projectId) {
    const project = await this.project(projectId);
    const agent = await this.gate(project, 'review', 'review');
    const rules = await this.loadRules();
    if (!rules) this.ctx.throw(400, '没有可用档位，不能调用');
    const shots = await this.shots(project.id);
    if (!shots.length) this.ctx.throw(400, '需要镜头');
    const result = await this.callSkill(project, agent, {
      action: 'review_cut',
      ...this.source(project, {}),
      model_profile: agent.model_profile,
      shots: shots.map(item => ({
        id: item.id,
        description: item.description,
        dialogue: item.dialogue,
        shot_size: item.shot_size,
        camera_move: item.camera_move,
        duration_ms: item.duration_ms,
      })),
      rules: (rules.rules || []).filter(item => item.enabled !== false).map(item => ({
        id: item.id,
        kind: item.kind,
        version: rules.version,
        body: item.body,
      })),
    });
    const issues = (result.output?.issues || []).map(item => ({
      shot_id: item.shot_id || '',
      rule_id: item.rule_id || '',
      level: item.level,
      message: item.message,
      node: item.node,
    }));
    return { issues, source: 'model', persisted: false };
  }

  async applyReview(projectId, payload) {
    const project = await this.project(projectId);
    if (payload.pass != null || payload.reject != null || payload.decision != null) {
      this.ctx.throw(400, '初审不能代替人工通过或驳回');
    }
    const issues = Array.isArray(payload.issues) ? payload.issues : [];
    const shots = await this.shots(project.id);
    const shotIds = new Set(shots.map(item => String(item.id)));
    const rows = issues.map(item => {
      const shotId = item.shot_id == null || item.shot_id === '' ? null : String(item.shot_id);
      if (shotId && !shotIds.has(shotId)) this.ctx.throw(400, '镜头不存在');
      if (![ 'warning', 'block' ].includes(item.level)) this.ctx.throw(400, '问题级别不正确');
      if (!REVIEW_NODES.includes(item.node)) this.ctx.throw(400, '需要回到的节点');
      return {
        project_id: project.id,
        shot_id: shotId ? Number(shotId) : null,
        rule_id: item.rule_id ? Number(item.rule_id) : null,
        level: item.level,
        message: String(item.message || '').slice(0, 500),
        node: item.node,
        source: 'model',
      };
    });
    await this.ctx.model.ReviewFinding.destroy({ where: { project_id: project.id, source: 'model' } });
    if (rows.length) await this.ctx.model.ReviewFinding.bulkCreate(rows);
    return this.findings(project.id);
  }

  async findings(projectId) {
    return this.ctx.model.ReviewFinding.findAll({
      where: { project_id: projectId },
      order: [[ 'id', 'ASC' ]],
    });
  }

  async buildSubtitles(projectId) {
    const project = await this.project(projectId);
    const view = await this.pipelineView(project.content_type);
    const node = view.nodes.find(item => item.node_key === 'subtitle');
    if (!node?.enabled) this.ctx.throw(400, '字幕节点未启用');
    const shots = (await this.shots(project.id)).filter(item => String(item.dialogue || '').trim());
    if (!shots.length) this.ctx.throw(400, '没有台词');
    const style = await this.ctx.model.Asset.findOne({
      where: { project_id: project.id, kind: 'subtitle_style', disabled: false },
      order: [[ 'id', 'ASC' ]],
    });
    let edit = await this.ctx.model.Edit.findOne({ where: { project_id: project.id } });
    if (!edit) {
      edit = await this.ctx.model.Edit.create({ project_id: project.id, title: project.name || '' });
    }
    await this.ctx.service.edit.ensureTracks(edit);
    const track = await this.ctx.model.EditTrack.findOne({ where: { edit_id: edit.id, kind: 'subtitle' } });
    await this.ctx.model.EditClip.destroy({ where: { track_id: track.id } });
    let cursor = 0;
    for (let index = 0; index < shots.length; index += 1) {
      const duration = Number(shots[index].duration_ms) > 0 ? Number(shots[index].duration_ms) : 3000;
      await this.ctx.model.EditClip.create({
        track_id: track.id,
        sort_order: index,
        start_ms: cursor,
        duration_ms: duration,
        trim_in_ms: 0,
        text: shots[index].dialogue,
      });
      cursor += duration;
    }
    return { style: style?.name || '', clips: shots.length, persisted: true };
  }
}

module.exports = SkillSuggestService;
