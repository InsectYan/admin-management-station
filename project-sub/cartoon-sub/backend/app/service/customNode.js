'use strict';

const Service = require('egg').Service;
const { customCatalog } = require('../lib/pipelineDefaults');
const { invokeSkill } = require('../lib/agentProxy');
const { productionInput } = require('../lib/productionInput');

const PANEL_FIELD = {
  conflict: 'conflict',
  twist: 'twist',
  rhythm: 'rhythm',
  branch: 'branches',
  product_check: 'product_note',
  selling_point: 'selling_points',
  brand_assets: 'logo',
  logo_show: 'logo',
  brand_color: 'brand_color',
  compliance_copy: 'compliance_line',
};

class CustomNodeService extends Service {
  async run(projectId, nodeKey, payload = {}) {
    const project = await this.ctx.model.Project.findByPk(projectId);
    if (!project) this.ctx.throw(404, '项目不存在');
    const key = String(nodeKey || '');
    const spec = customCatalog(project.content_type).find(item => item.node_key === key);
    const episode = await this.ctx.service.project.ensureEpisode(project.id);
    if (!spec) {
      await episode.update({ warning: '这个节点加载失败，已退回脚本节点', current_node: 'script' });
      return {
        node_key: key,
        title: '',
        fallback: 'script',
        warning: '这个节点加载失败，已退回脚本节点',
        findings: [],
        note: '',
        persisted: false,
      };
    }
    const row = await this.ctx.model.PipelineNode.findOne({
      where: { content_type: project.content_type, node_key: key, kind: 'custom' },
    });
    if (!row) this.ctx.throw(400, '这个节点还没加到流水线');
    if (!row.enabled) this.ctx.throw(400, '节点未启用');
    if (episode.warning) await episode.update({ warning: '' });
    const findings = await this.inspect(project, key);
    await this.ctx.model.ReviewFinding.destroy({
      where: { project_id: project.id, node: key, source: 'check' },
    });
    if (findings.length) {
      await this.ctx.model.ReviewFinding.bulkCreate(findings.map(item => ({
        project_id: project.id,
        shot_id: item.shot_id || null,
        level: 'warning',
        message: item.message,
        node: key,
        source: 'check',
      })));
    }
    const body = {
      node_key: key,
      title: spec.title,
      fallback: null,
      warning: '',
      findings,
      note: findings.length ? '' : '这项检查没有发现问题',
      persisted: false,
    };
    if (key === 'chapter_parse' && payload.suggest) {
      body.suggestion = await this.parseChapter(project);
      body.note = '建议还没有写入';
    }
    return body;
  }

  async parseChapter(project) {
    const chapter = await this.ctx.model.Import.findOne({
      where: { project_id: project.id },
      order: [[ 'id', 'ASC' ]],
    });
    if (!chapter || !String(chapter.body || '').trim()) this.ctx.throw(400, '还没有可解析的章节');
    const result = await invokeSkill(this.ctx, {
      skill: 'cartoon-script-skill',
      action: 'draft',
      payload: {
        chapter_title: chapter.chapter_title || '',
        body: chapter.body,
        visual_style: project.visual_style || '',
        ...productionInput(project),
      },
    });
    return result.output || {};
  }

  async inspect(project, nodeKey) {
    if (PANEL_FIELD[nodeKey]) return this.panelFinding(project, nodeKey, PANEL_FIELD[nodeKey]);
    if (nodeKey === 'chapter_parse') return this.chapterFinding(project);
    if (nodeKey === 'character_lock') return this.characterFinding(project);
    if (nodeKey === 'style_lock') {
      return project.visual_style ? [] : [{ message: '还没有画风' }];
    }
    if (nodeKey === 'episode_assets') return this.assetFinding(project);
    if (nodeKey === 'batch_episodes') return this.batchFinding(project);
    if (nodeKey === 'demo_shot') return this.demoFinding(project);
    if (nodeKey === 'platform_spec') return this.specFinding(project);
    if ([ 'knowledge', 'chart', 'terms', 'density' ].includes(nodeKey)) return this.copyFinding(project, nodeKey);
    return [{ message: '这项检查还没有对应规则' }];
  }

  async panelFinding(project, nodeKey, field) {
    const panel = await this.ctx.service.project.panelOf(project.id);
    const hit = (panel.fields || []).find(item => item.key === field);
    if (hit?.value) return [];
    return [{ message: `${hit?.label || nodeKey}还没有填写` }];
  }

  async chapterFinding(project) {
    const rows = await this.ctx.model.Import.findAll({ where: { project_id: project.id } });
    const ready = rows.some(item => String(item.body || '').trim());
    return ready ? [] : [{ message: '还没有可解析的章节' }];
  }

  async characterFinding(project) {
    const assets = await this.ctx.model.Asset.findAll({
      where: { project_id: project.id, kind: 'character', disabled: false },
    });
    if (!assets.length) return [{ message: '还没有角色资产' }];
    const [ bindings, shots ] = await Promise.all([
      this.ctx.model.ShotBinding.findAll({ where: { project_id: project.id } }),
      this.ctx.model.Shot.findAll({ where: { project_id: project.id } }),
    ]);
    const findings = [];
    for (const asset of assets) {
      if (!String(asset.consistency_note || '').trim()) {
        findings.push({ message: `${asset.name}还没有一致性备注` });
      }
      for (const binding of bindings.filter(item => item.asset_id === asset.id)) {
        const shot = shots.find(item => item.id === binding.shot_id);
        if (shot && !String(shot.description || '').includes(asset.name)) {
          findings.push({ shot_id: shot.id, message: `镜头 ${shot.id} 没有沿用角色 ${asset.name}` });
        }
      }
    }
    return findings;
  }

  async assetFinding(project) {
    const count = await this.ctx.model.Asset.count({
      where: { project_id: project.id, kind: 'character', disabled: false },
    });
    return count ? [] : [{ message: '这一集还没有角色资产' }];
  }

  async batchFinding(project) {
    const count = await this.ctx.model.Batch.count({ where: { project_id: project.id } });
    return count ? [] : [{ message: '还没有批量选题' }];
  }

  async demoFinding(project) {
    const count = await this.ctx.model.Shot.count({ where: { project_id: project.id } });
    return count ? [] : [{ message: '还没有演示镜头' }];
  }

  async specFinding(project) {
    const count = await this.ctx.model.ExportSpec.count({ where: { project_id: project.id } });
    return count ? [] : [{ message: '还没有平台规格' }];
  }

  async copyFinding(project, nodeKey) {
    const blocks = await this.ctx.model.CopyBlock.findAll({ where: { project_id: project.id } });
    const text = blocks.map(item => `${item.title || ''}\n${item.body || ''}`).join('\n').trim();
    if (nodeKey === 'chart') {
      return /[图表]/.test(text) ? [] : [{ message: '文案里还没有图表说明' }];
    }
    if (nodeKey === 'density') {
      return text.length >= 40 ? [] : [{ message: '信息偏少' }];
    }
    if (text) return [];
    return [{ message: nodeKey === 'terms' ? '还没有术语文案' : '还没有知识点文案' }];
  }
}

module.exports = CustomNodeService;
