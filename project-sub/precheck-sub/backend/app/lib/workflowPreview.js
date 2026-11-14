'use strict';

const TEXT_KEYS = new Set([ 'text', 'prompt', 'positive_prompt', 'negative_prompt', 'text_input', 'custom_prompt' ]);
const NUMBER_KEYS = new Set([
  'seed', 'noise_seed', 'steps', 'cfg', 'denoise', 'width', 'height',
  'batch_size', 'length', 'frames', 'frame_rate', 'fps', 'resolution',
]);
const CHOICE_KEYS = new Set([ 'sampler_name', 'scheduler' ]);
const FRAME_KEYS = new Set([ 'length', 'frames', 'num_frames', 'frame_count' ]);
const FPS_KEYS = new Set([ 'fps', 'frame_rate' ]);
const VIDEO_CLASS = /video|(?:^|[^a-z])wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi/i;
const LABEL = {
  text: '提示词',
  prompt: '提示词',
  positive_prompt: '正向提示词',
  negative_prompt: '负向提示词',
  text_input: '补充说明',
  custom_prompt: '补充说明',
  max_tokens: '最长回答',
  seed: '种子',
  noise_seed: '种子',
  steps: '步数',
  cfg: 'CFG',
  denoise: '重绘幅度',
  width: '宽度',
  height: '高度',
  batch_size: '批次',
  resolution: '分辨率',
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
    if (node.class_type === 'LoadVideo' || node.class_type === 'GetVideoComponents') return false;
    if (VIDEO_CLASS.test(node.class_type)) return true;
    const inputs = node.inputs || {};
    return [ ...FPS_KEYS, ...FRAME_KEYS ].some(key => {
      const value = inputs[key];
      return value != null && !Array.isArray(value) && typeof value !== 'object';
    });
  });
}

function frameAlign(classType) {
  if (/minimax/i.test(classType || '')) return '17k5';
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
  if (align === '17k5') {
    let frames = Math.max(5, count);
    while (frames % 17 !== 5) frames += 1;
    return frames;
  }
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

const CAPTION_CLASS = /AILab_QwenVL|^JC$|Florence2|WD14Tagger/i;
const IMAGE_BATCH_MAX = 8;

function isImageWorkflow(graph) {
  if (isVideoWorkflow(graph)) return false;
  const nodes = Object.values(graph || {});
  if (nodes.some(node => CAPTION_CLASS.test(String(node?.class_type || '')))) return false;
  return nodes.some(node => node?.class_type === 'SaveImage' || node?.class_type === 'PreviewImage');
}

function randomImageSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  const span = (10 ** digits) - min;
  return min + Math.floor(Math.random() * span);
}

function uniqueImageSeeds(count) {
  const used = new Set();
  const list = [];
  while (list.length < count) {
    const value = randomImageSeed();
    if (used.has(value)) continue;
    used.add(value);
    list.push(value);
  }
  return list;
}

function manualSeed(values) {
  const field = (values || []).find(item => item?.key === 'seed' || item?.key === 'noise_seed');
  if (!field || field.value == null || field.value === '') return null;
  const number = Number(field.value);
  if (!Number.isSafeInteger(number) || number < 0) {
    const error = new Error('种子需要是非负整数');
    error.status = 400;
    throw error;
  }
  return number;
}

function acceptAutoSeeds(seeds, count) {
  if (!Array.isArray(seeds) || seeds.length !== count) return null;
  const numbers = seeds.map(item => Number(item));
  const valid = numbers.every(item => Number.isSafeInteger(item) && item >= 10000000 && item <= 9999999999);
  return valid ? numbers : null;
}

function resolveImageSeeds(graph, values, batch, seeds) {
  if (!isImageWorkflow(graph)) return [ null ];
  const manual = manualSeed(values);
  const requested = Math.round(Number(batch) || (Array.isArray(seeds) ? seeds.length : 0) || 1);
  if (manual != null) {
    if (requested > 1 || (Array.isArray(seeds) && seeds.length > 1)) {
      const error = new Error('填写了种子时批次只能为 1');
      error.status = 400;
      throw error;
    }
    return [ manual ];
  }
  if (!Number.isInteger(requested) || requested < 1 || requested > IMAGE_BATCH_MAX) {
    const error = new Error(`批次需要是 1 到 ${IMAGE_BATCH_MAX} 的整数`);
    error.status = 400;
    throw error;
  }
  return acceptAutoSeeds(seeds, requested) || uniqueImageSeeds(requested);
}

function pinBatchSize(graph) {
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs;
    if (!inputs || Array.isArray(inputs.batch_size) || typeof inputs.batch_size !== 'number') return;
    inputs.batch_size = 1;
  });
  return graph;
}

function listPreviewFields(apiJson) {
  const roles = promptRoles(apiJson);
  const image = isImageWorkflow(apiJson);
  const fields = [];
  Object.entries(apiJson || {}).forEach(([ nodeId, node ]) => {
    if (!node || typeof node !== 'object' || !node.class_type) return;
    const inputs = node.inputs || {};
    Object.entries(inputs).forEach(([ key, value ]) => {
      if (image && key === 'batch_size') return;
      if (Array.isArray(value) || value == null || typeof value === 'object') return;
      const type = fieldType(key, value);
      if (!type) return;
      const namedPrompt = key === 'prompt' || key === 'negative_prompt';
      const role = type === 'text' && !namedPrompt ? roles.get(String(nodeId)) : '';
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
    const frameField = fields.find(field => FRAME_KEYS.has(field.key));
    const align = frameField ? frameAlign(frameField.class_type) : 'round';
    fields.unshift({
      id: 'duration_sec',
      node_id: '',
      class_type: '',
      key: 'duration_sec',
      type: 'duration',
      label: '生成时间（秒）',
      value: null,
      fps: readFps(apiJson),
      align,
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
    if (item?.type === 'duration' || item?.key === 'duration_sec' || item?.type === 'image' || item?.type === 'video') return;
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

function collectText(outputs) {
  const parts = [];
  const push = (value) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const text = String(value ?? '').trim();
    if (text) parts.push(text);
  };
  Object.values(outputs || {}).forEach(entry => {
    push(entry?.text);
    push(entry?.tags);
  });
  return parts.join('\n');
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
  collectText,
  framesForDuration,
  readFps,
  isImageWorkflow,
  resolveImageSeeds,
  pinBatchSize,
  IMAGE_BATCH_MAX,
};
