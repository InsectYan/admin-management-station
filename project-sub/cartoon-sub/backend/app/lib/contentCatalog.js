'use strict';

const TYPES = [
  { id: 'ai_comic', label: '漫剧', bind: 'required', copy: false, panel: [] },
  {
    id: 'ai_short',
    label: '短剧',
    bind: 'required',
    copy: false,
    panel: [
      { key: 'conflict', label: '冲突' },
      { key: 'twist', label: '反转' },
      { key: 'rhythm', label: '节奏' },
      { key: 'branches', label: '互动分支' },
    ],
  },
  { id: 'ai_science', label: '科普', bind: 'local', copy: true, panel: [] },
  {
    id: 'ai_commerce',
    label: '电商',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'product_note', label: '商品素材' },
      { key: 'selling_points', label: '卖点' },
      { key: 'comparison', label: '对比', optional: true },
    ],
  },
  {
    id: 'ai_brand',
    label: '品牌',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'logo', label: 'Logo' },
      { key: 'brand_color', label: '品牌色' },
      { key: 'bumper', label: '片头片尾' },
      { key: 'compliance_line', label: '合规句' },
      { key: 'font', label: '字体', optional: true },
      { key: 'visual_spec', label: '视觉规范', optional: true },
    ],
    custom: [
      { node_key: 'brand_assets', title: '品牌资产' },
      { node_key: 'logo_show', title: 'Logo 露出' },
      { node_key: 'brand_color', title: '品牌色' },
      { node_key: 'compliance_copy', title: '合规文案' },
    ],
  },
  {
    id: 'ai_documentary',
    label: '纪录片',
    bind: 'required',
    copy: false,
    panel: [
      { key: 'narration', label: '旁白' },
      { key: 'archive_note', label: '史料' },
      { key: 'music_mood', label: '音乐氛围' },
    ],
  },
  {
    id: 'ai_music',
    label: '音乐 MV',
    bind: 'optional',
    copy: false,
    panel: [
      { key: 'lyric_timeline', label: '歌词时间轴' },
      { key: 'beat', label: '节拍' },
    ],
  },
  {
    id: 'ai_children',
    label: '儿童',
    bind: 'required',
    copy: false,
    panel: [
      { key: 'speech_rate', label: '语速' },
      { key: 'rating', label: '分级' },
      { key: 'visual_scale', label: '画面尺度' },
    ],
  },
  {
    id: 'ai_language',
    label: '语言学习',
    bind: 'required',
    copy: false,
    panel: [
      { key: 'subtitle_langs', label: '多语字幕' },
      { key: 'pronunciation', label: '发音卡' },
    ],
  },
  {
    id: 'ai_news',
    label: '新闻',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'timeline', label: '时间线' },
      { key: 'data_note', label: '数据' },
      { key: 'sources', label: '事实来源' },
    ],
  },
  {
    id: 'ai_travel',
    label: '旅游',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'map_note', label: '地图' },
      { key: 'spots', label: '景点卡' },
    ],
  },
  {
    id: 'ai_fitness',
    label: '健身',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'steps', label: '动作步骤' },
      { key: 'tempo', label: '节奏' },
    ],
  },
  {
    id: 'ai_sleep',
    label: '助眠',
    bind: 'local',
    copy: true,
    panel: [
      { key: 'breath', label: '呼吸节奏' },
      { key: 'loop', label: '循环' },
      { key: 'noise', label: '白噪音' },
    ],
  },
  {
    id: 'ai_game',
    label: '游戏二创',
    bind: 'required',
    copy: false,
    panel: [
      { key: 'character_ref', label: '角色档案' },
      { key: 'style_template', label: '风格模板' },
    ],
  },
];

const LEGACY_KEYS = [ 'conflict', 'twist', 'rhythm', 'branches', 'product_note', 'selling_points', 'comparison' ];

function contentType(id) {
  return TYPES.find(item => item.id === id) || null;
}

function contentTypeIds() {
  return TYPES.map(item => item.id);
}

function isLocal(id) {
  return contentType(id)?.bind === 'local';
}

function pinModeOf(id) {
  const type = contentType(id);
  if (!type || type.bind === 'required') return 'required';
  return type.bind === 'optional' ? 'optional' : 'local';
}

function assertKnown(id) {
  if (!contentType(id)) {
    const err = new Error('这个内容类型还没开放');
    err.status = 400;
    throw err;
  }
}

function readPayload(row) {
  if (!row?.payload) return {};
  try {
    const parsed = JSON.parse(row.payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function fieldValue(row, key) {
  const payload = readPayload(row);
  if (Object.prototype.hasOwnProperty.call(payload, key)) return String(payload[key] || '').trim();
  if (row && LEGACY_KEYS.includes(key)) return String(row[key] || '').trim();
  return '';
}

function languageCount(value) {
  return String(value || '').split(/[,，、]/).map(item => item.trim()).filter(Boolean);
}

function panelFields(type, row) {
  return (type?.panel || []).map(field => ({
    key: field.key,
    label: field.label,
    optional: Boolean(field.optional),
    value: fieldValue(row, field.key),
  }));
}

function panelReady(type, row) {
  if (!type?.panel?.length) return true;
  const fields = panelFields(type, row);
  if (fields.some(field => !field.optional && !field.value)) return false;
  if (type.id === 'ai_children' && fieldValue(row, 'rating') !== '全年龄') return false;
  if (type.id === 'ai_language' && languageCount(fieldValue(row, 'subtitle_langs')).length < 2) return false;
  if (type.id === 'ai_sleep') {
    const loop = Number(fieldValue(row, 'loop'));
    if (!Number.isInteger(loop) || loop <= 0) return false;
  }
  return true;
}

function normalizePanel(type, payload) {
  const text = key => String(payload?.[key] || '').trim();
  if (type.id === 'ai_children' && text('rating') && text('rating') !== '全年龄') {
    const err = new Error('儿童分级需要是全年龄');
    err.status = 400;
    throw err;
  }
  if (type.id === 'ai_sleep' && text('loop')) {
    const loop = Number(text('loop'));
    if (!Number.isInteger(loop) || loop <= 0) {
      const err = new Error('循环次数需要是正整数');
      err.status = 400;
      throw err;
    }
  }
  const stored = {};
  for (const field of type.panel) stored[field.key] = text(field.key);
  return stored;
}

module.exports = {
  TYPES,
  LEGACY_KEYS,
  contentType,
  contentTypeIds,
  isLocal,
  pinModeOf,
  assertKnown,
  panelFields,
  panelReady,
  normalizePanel,
};
