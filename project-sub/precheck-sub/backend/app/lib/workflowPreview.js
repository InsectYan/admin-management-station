'use strict';

const TEXT_KEYS = new Set([ 'text', 'prompt', 'positive_prompt', 'negative_prompt' ]);
const NUMBER_KEYS = new Set([
  'seed', 'noise_seed', 'steps', 'cfg', 'denoise', 'width', 'height',
  'batch_size', 'length', 'frames', 'frame_rate', 'fps',
]);
const CHOICE_KEYS = new Set([ 'sampler_name', 'scheduler' ]);
const FRAME_KEYS = new Set([ 'length', 'frames', 'num_frames', 'frame_count' ]);
const FPS_KEYS = new Set([ 'fps', 'frame_rate' ]);
const VIDEO_CLASS = /video|wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi/i;
const LABEL = {
  text: '提示词',
  prompt: '提示词',
  positive_prompt: '正向提示词',
  negative_prompt: '负向提示词',
  seed: '种子',
  noise_seed: '种子',
  steps: '步数',
  cfg: 'CFG',
  denoise: '重绘幅度',
  width: '宽度',
  height: '高度',
  batch_size: '批次',
  length: '帧数',
  frames: '帧数',
  frame_rate: '帧率',
  fps: '帧率',
  sampler_name: '采样器',
  scheduler: '调度器',
};

function promptRoles(graph) {
  const roles = new Map();
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs || {};
    if (Array.isArray(inputs.positive)) roles.set(String(inputs.positive[0]), '正向提示词');
    if (Array.isArray(inputs.negative)) roles.set(String(inputs.negative[0]), '负向提示词');
  });
  return roles;
}

function fieldType(key, value) {
  if (TEXT_KEYS.has(key)) return 'text';
  if (NUMBER_KEYS.has(key)) return 'number';
  if (CHOICE_KEYS.has(key)) return 'choice';
  if (typeof value === 'number') return 'number';
  return '';
}

function isVideoWorkflow(graph) {
  return Object.values(graph || {}).some(node => {
    if (!node?.class_type) return false;
    if (VIDEO_CLASS.test(node.class_type)) return true;
    const inputs = node.inputs || {};
    return [ ...FPS_KEYS, ...FRAME_KEYS ].some(key => {
      const value = inputs[key];
      return value != null && !Array.isArray(value) && typeof value !== 'object';
    });
  });
}

function frameAlign(classType) {
  if (/wan|hunyuan|mochi/i.test(classType || '')) return '4n1';
  if (/ltx/i.test(classType || '')) return '8n1';
  return 'round';
}

function readFps(graph) {
  const found = [];
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs || {};
    FPS_KEYS.forEach(key => {
      const value = Number(inputs[key]);
      if (!Array.isArray(inputs[key]) && Number.isFinite(value) && value > 0) {
        found.push({ class_type: node.class_type, value });
      }
    });
  });
  const preferred = found.find(item => item.class_type === 'CreateVideo' || item.class_type === 'SaveVideo');
  return preferred?.value || found[0]?.value || 16;
}

function alignFrames(raw, align) {
  const count = Math.max(1, Math.round(Number(raw)));
  if (align === '4n1') return Math.max(1, 4 * Math.round((count - 1) / 4) + 1);
  if (align === '8n1') return Math.max(1, 8 * Math.round((count - 1) / 8) + 1);
  return count;
}

function framesForDuration(seconds, fps, classType) {
  return alignFrames(Number(seconds) * Number(fps), frameAlign(classType));
}

function applyDuration(graph, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const fps = readFps(graph);
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs;
    if (!inputs) return;
    FRAME_KEYS.forEach(key => {
      if (Array.isArray(inputs[key]) || typeof inputs[key] !== 'number') return;
      inputs[key] = framesForDuration(seconds, fps, node.class_type);
    });
  });
}

function listPreviewFields(apiJson) {
  const roles = promptRoles(apiJson);
  const fields = [];
  Object.entries(apiJson || {}).forEach(([ nodeId, node ]) => {
    if (!node || typeof node !== 'object' || !node.class_type) return;
    const inputs = node.inputs || {};
    Object.entries(inputs).forEach(([ key, value ]) => {
      if (Array.isArray(value) || value == null || typeof value === 'object') return;
      const type = fieldType(key, value);
      if (!type) return;
      const role = type === 'text' ? roles.get(String(nodeId)) : '';
      fields.push({
        id: `${nodeId}.${key}`,
        node_id: String(nodeId),
        class_type: node.class_type,
        key,
        type,
        label: role || LABEL[key] || `${node.class_type} ${key}`,
        value,
      });
    });
  });
  if (isVideoWorkflow(apiJson)) {
    const wan = fields.some(field => FRAME_KEYS.has(field.key) && frameAlign(field.class_type) === '4n1');
    fields.unshift({
      id: 'duration_sec',
      node_id: '',
      class_type: '',
      key: 'duration_sec',
      type: 'duration',
      label: '生成时间（秒）',
      value: null,
      fps: readFps(apiJson),
      align: wan ? '4n1' : 'round',
    });
  }
  return fields;
}

function durationSeconds(values) {
  const item = (values || []).find(entry => entry?.type === 'duration' || entry?.key === 'duration_sec');
  if (!item || item.value == null || item.value === '') return null;
  const seconds = Number(item.value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function applyPreviewValues(apiJson, values) {
  const graph = JSON.parse(JSON.stringify(apiJson));
  (values || []).forEach(item => {
    if (item?.type === 'duration' || item?.key === 'duration_sec') return;
    const node = graph[String(item.node_id)];
    if (!node?.inputs || Array.isArray(node.inputs[item.key])) return;
    if (item.type === 'number') {
      const number = Number(item.value);
      if (Number.isFinite(number)) node.inputs[item.key] = number;
      return;
    }
    node.inputs[item.key] = item.value == null ? '' : String(item.value);
  });
  applyDuration(graph, durationSeconds(values));
  return graph;
}

function collectMedia(outputs) {
  const files = [];
  Object.values(outputs || {}).forEach(entry => {
    (entry?.images || []).forEach(file => {
      const video = /\.(mp4|webm|mkv|gif)$/i.test(file.filename || '');
      files.push({ ...file, media_kind: video ? 'video' : 'image' });
    });
    (entry?.gifs || []).forEach(file => files.push({ ...file, media_kind: 'video' }));
    (entry?.videos || []).forEach(file => files.push({ ...file, media_kind: 'video' }));
  });
  return files;
}

module.exports = {
  listPreviewFields,
  applyPreviewValues,
  collectMedia,
  framesForDuration,
  readFps,
};
