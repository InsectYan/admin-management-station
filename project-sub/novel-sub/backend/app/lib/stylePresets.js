'use strict';

const PRESETS = [
  { id: 'serious', name: '严肃', note: '语气克制，少用网络梗，情节按因果推进。' },
  { id: 'power', name: '爽文', note: '主角目标明确，冲突快，反馈及时，少铺垫空转。' },
  { id: 'sweet', name: '甜宠', note: '关系推进温柔，冲突可和解，少用残酷惩罚。' },
  { id: 'suspense', name: '悬疑', note: '信息分段放出，保留疑点，不要提前说破。' },
  { id: 'comedy', name: '搞笑', note: '用日常反差和对话制造笑点，少用沉重说教。' },
  { id: 'tragic', name: '虐心', note: '关系要付出代价，少用轻易和好收场。' },
  { id: 'healing', name: '治愈', note: '节奏放慢，用小事回暖，冲突停在还能承受的地方。' },
  { id: 'epic', name: '史诗', note: '把个人遭遇放进更大的时代，句子稳，少用俏皮话。' },
  { id: 'dark', name: '暗黑', note: '选择没有干净的一边，把代价写清楚。' },
  { id: 'literary', name: '文艺', note: '多用意象和留白，少用直白说教和密集梗。' },
  { id: 'hotblood', name: '热血', note: '信念说得明白，对抗逐级加重，少用冷眼旁观。' },
  { id: 'realistic', name: '写实', note: '按日常逻辑和代价推进，少用开挂解释。' },
  { id: 'ironic', name: '讽刺', note: '用反差指出荒唐，少用说教把结论讲死。' },
  { id: 'cold', name: '冷硬', note: '情绪收着，动作和结果说话，少用感叹和煽情。' },
];

function listStylePresets() {
  return PRESETS.map(item => ({ ...item }));
}

function stylePreset(id) {
  return PRESETS.find(item => item.id === String(id || '')) || null;
}

module.exports = { listStylePresets, stylePreset };
