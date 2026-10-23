'use strict';

const PRESETS = [
  { id: 'serious', name: '严肃', note: '语气克制，少用网络梗，情节按因果推进。' },
  { id: 'power', name: '爽文', note: '主角目标明确，冲突快，反馈及时，少铺垫空转。' },
  { id: 'sweet', name: '甜宠', note: '关系推进温柔，冲突可和解，少用残酷惩罚。' },
  { id: 'suspense', name: '悬疑', note: '信息分段放出，保留疑点，不要提前说破。' },
  { id: 'comedy', name: '搞笑', note: '用日常反差和对话制造笑点，少用沉重说教。' },
];

function listStylePresets() {
  return PRESETS.map(item => ({ ...item }));
}

function stylePreset(id) {
  return PRESETS.find(item => item.id === String(id || '')) || null;
}

module.exports = { listStylePresets, stylePreset };
