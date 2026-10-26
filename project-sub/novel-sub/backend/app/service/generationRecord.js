'use strict';

const Service = require('egg').Service;
const { formatDateTime } = require('../lib/formatDateTime');
const { fieldDiff, lineDiff } = require('../lib/textDiff');

const KIND_LABEL = {
  basic: '基础信息',
  world: '世界观',
  faction: '门派组织',
  character: '人物',
  outline: '大纲',
  chapter_list: '章节目录',
  body: '正文',
};

const BASIC_FIELDS = [
  ['title', '书名'],
  ['creative_intent', '立意'],
  ['summary', '简介'],
  ['story_overview', '概要'],
];

const WORLD_FIELDS = [
  ['era', '时代'],
  ['geography', '地理'],
  ['social_rules', '社会规则'],
  ['power_system', '力量体系'],
  ['technology', '技术'],
  ['history_notes', '历史'],
];

const CHARACTER_FIELDS = [
  ['role', '角色'],
  ['personality', '性格'],
  ['background', '背景'],
  ['goal', '目标'],
  ['relations', '关系'],
];

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

class GenerationRecordService extends Service {
  serialize(row) {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    return {
      id: json.id,
      novel_id: json.novel_id,
      kind: json.kind,
      kind_label: KIND_LABEL[json.kind] || json.kind,
      action: json.action,
      action_label: json.action === 'add' ? '新增' : '调整',
      title: json.title || '',
      summary: json.summary || '',
      diff: Array.isArray(json.diff_json) ? json.diff_json : [],
      created_at: formatDateTime(json.created_at),
    };
  }

  async list(novelId) {
    const rows = await this.ctx.model.NovelGenerationRecord.findAll({
      where: { novel_id: novelId },
      order: [['id', 'DESC']],
      limit: 200,
    });
    return rows.map((row) => this.serialize(row));
  }

  async write(novelId, record) {
    const diff = Array.isArray(record.diff) ? record.diff.filter((line) => String(line.text || '').trim()) : [];
    if (!diff.length) return null;
    const row = await this.ctx.model.NovelGenerationRecord.create({
      novel_id: novelId,
      kind: record.kind,
      action: record.action || 'adjust',
      title: String(record.title || '').slice(0, 200),
      summary: String(record.summary || '').slice(0, 500),
      diff_json: diff.slice(0, 240),
    });
    return this.serialize(row);
  }

  async captureBasic(novelId, before, after) {
    const diff = [];
    for (const [key, label] of BASIC_FIELDS) {
      diff.push(...fieldDiff(label, before?.[key], after?.[key]));
    }
    return this.write(novelId, {
      kind: 'basic',
      action: 'adjust',
      title: after?.title || before?.title || '基础信息',
      summary: '保存了 AI 生成的基础信息',
      diff,
    });
  }

  async captureBody(novelId, chapter, beforeText, afterText) {
    const diff = lineDiff(beforeText, afterText);
    return this.write(novelId, {
      kind: 'body',
      action: beforeText ? 'adjust' : 'add',
      title: chapter?.title || '正文',
      summary: beforeText ? `调整了「${chapter?.title || '本章'}」正文` : `写入了「${chapter?.title || '本章'}」正文`,
      diff,
    });
  }

  characterRecords(beforeList, afterList) {
    const before = new Map((beforeList || []).map((row) => [String(row.name || row.id || ''), row]));
    const records = [];
    for (const row of afterList || []) {
      const key = String(row.name || row.id || '');
      if (!key) continue;
      const prev = before.get(key);
      if (!prev) {
        const diff = [];
        if (row.name) diff.push({ op: 'add', field: '姓名', text: row.name });
        for (const [field, label] of CHARACTER_FIELDS) {
          if (textOf(row[field])) diff.push({ op: 'add', field: label, text: textOf(row[field]) });
        }
        records.push({
          kind: 'character',
          action: 'add',
          title: row.name || '新人物',
          summary: `新增人物 ${row.name || ''}`.trim(),
          diff,
        });
        continue;
      }
      const diff = [];
      for (const [field, label] of CHARACTER_FIELDS) {
        diff.push(...fieldDiff(label, prev[field], row[field]));
      }
      if (diff.length) {
        records.push({
          kind: 'character',
          action: 'adjust',
          title: row.name || '人物',
          summary: `调整人物 ${row.name || ''}`.trim(),
          diff,
        });
      }
    }
    return records;
  }

  async captureSetting(novelId, before, after, keys) {
    const touched = new Set(keys || []);
    const jobs = [];
    if (touched.has('world')) {
      const diff = [];
      for (const [field, label] of WORLD_FIELDS) {
        diff.push(...fieldDiff(label, before?.world?.[field], after?.world?.[field]));
      }
      const beforeTimeline = (before?.world?.timeline || []).map((item) => `${item.year || ''} ${item.event || ''}`.trim()).join('\n');
      const afterTimeline = (after?.world?.timeline || []).map((item) => `${item.year || ''} ${item.event || ''}`.trim()).join('\n');
      diff.push(...fieldDiff('年表', beforeTimeline, afterTimeline));
      jobs.push({ kind: 'world', action: 'adjust', title: '世界观', summary: '保存了 AI 生成的世界观', diff });
    }
    if (touched.has('factions')) {
      const flat = (list) => (list || []).map((item) => `${item.name || ''} ${item.description || ''}`.trim()).join('\n');
      jobs.push({
        kind: 'faction',
        action: 'adjust',
        title: '门派组织',
        summary: '保存了 AI 生成的门派组织',
        diff: lineDiff(flat(before?.factions), flat(after?.factions)),
      });
    }
    if (touched.has('characters') || touched.has('character_edges')) {
      jobs.push(...this.characterRecords(before?.characters, after?.characters));
    }
    if (touched.has('outline')) {
      const flat = (setting) => (setting?.outline?.volumes || []).map((vol) => {
        const groups = (vol.groups || []).map((group) => {
          const sections = (group.sections || []).map((sec) => sec.title).filter(Boolean).join('、');
          return `${group.title || ''}${sections ? `：${sections}` : ''}`;
        }).join('；');
        return `${vol.title || ''} ${vol.word_target || ''} ${groups}`.trim();
      }).join('\n');
      jobs.push({
        kind: 'outline',
        action: 'adjust',
        title: '大纲',
        summary: '保存了 AI 生成的大纲',
        diff: lineDiff(flat(before), flat(after)),
      });
    }
    if (touched.has('chapters')) {
      const flat = (setting) => (setting?.chapters || []).map((ch) => `${ch.order || ''} ${ch.title || ''} ${ch.outline_ref || ''}`.trim()).join('\n');
      jobs.push({
        kind: 'chapter_list',
        action: 'adjust',
        title: '章节目录',
        summary: '保存了 AI 生成的章节目录',
        diff: lineDiff(flat(before), flat(after)),
      });
    }
    const saved = [];
    for (const job of jobs) {
      const row = await this.write(novelId, job);
      if (row) saved.push(row);
    }
    return saved;
  }
}

module.exports = GenerationRecordService;
