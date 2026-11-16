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
  frame_rate: '每秒帧数',
  fps: '每秒帧数',
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
    if (CAPTION_CLASS.test(node.class_type)) return false;
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
const CAPTION_RELATION = [
  '输出上限和真实帧率各管一件事，互不影响。',
  '输出上限是模型这次最多新写的 token。写满就停，句子可以停在半截。它不改变看了几帧。',
  '真实帧率只用于视频。片子整段解码，再均匀抽 16 帧。时间戳用原始帧号除以帧率，模型看到的时长 = 总帧数 / 帧率。留空就把文件里的帧率接上。12 秒、30 帧/秒的片子留空或填 30，时间轴仍约 12 秒。以前把抽到的 16 帧当成 24 帧/秒，最后一个时间戳会变成 0.6 秒。',
];
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
  if (!isImageWorkflow(graph) && !isVideoWorkflow(graph)) return [ null ];
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
    const duration = {
      id: 'duration_sec',
      node_id: '',
      class_type: '',
      key: 'duration_sec',
      type: 'duration',
      label: '生成时间（秒）',
      value: null,
      fps: readFps(apiJson),
      align,
    };
    const rates = [];
    const rest = [];
    fields.forEach(field => {
      if (!FPS_KEYS.has(field.key)) {
        rest.push(field);
        return;
      }
      field.label = '每秒帧数';
      field.min = 1;
      field.max = 120;
      field.step = 1;
      field.precision = 0;
      field.hint = `${field.class_type} 的每秒帧数。生成时间按这个数换成帧数。`;
      rates.push(field);
    });
    return decorateCaptionFields(apiJson, [ duration, ...rates, ...rest ]);
  }
  return decorateCaptionFields(apiJson, fields);
}

function captionKind(apiJson) {
  const nodes = Object.values(apiJson || {});
  const caption = nodes.filter(node => CAPTION_CLASS.test(String(node?.class_type || '')));
  if (!caption.length) return null;
  const qwen = caption.find(node => /AILab_QwenVL/i.test(node.class_type));
  const video = nodes.some(node => node?.class_type === 'GetVideoComponents');
  return {
    video: Boolean(video && qwen),
    joy: caption.some(node => node.class_type === 'JC'),
    florence: caption.some(node => node.class_type === 'Florence2Run'),
    wd14: caption.some(node => /WD14Tagger/i.test(node.class_type)),
    qwenId: qwen ? Object.entries(apiJson).find(([, node ]) => node === qwen)?.[0] || '' : '',
  };
}

function decorateCaptionFields(apiJson, fields) {
  const kind = captionKind(apiJson);
  if (!kind) return fields;
  const limitMax = kind.joy ? 2048 : 4096;
  const limitMin = kind.florence ? 1 : 64;
  const limits = [];
  const rest = [];
  fields.forEach(field => {
    if (field.key !== 'max_tokens' && field.key !== 'max_new_tokens') {
      rest.push(field);
      return;
    }
    field.label = '输出上限';
    field.min = limitMin;
    field.max = limitMax;
    field.step = 1;
    field.precision = 0;
    field.hint = `写满这个 token 数就停。这项只管文字长短。当前工作流可填 ${limitMin} 到 ${limitMax}。`;
    limits.push(field);
  });
  const note = {
    id: 'caption_relation',
    node_id: '',
    class_type: '',
    key: 'caption_relation',
    type: 'note',
    label: '输出上限和真实帧率',
    value: '',
    lines: CAPTION_RELATION,
  };
  const limit = limits.length ? limits : [{
    id: 'caption_limit',
    node_id: '',
    class_type: '',
    key: 'max_tokens',
    type: 'number',
    label: '输出上限',
    value: null,
    disabled: true,
    hint: '这条是标签反推，按置信度出词，没有句子长度，这项不生效。',
  }];
  const fps = {
    id: 'caption_fps',
    node_id: kind.qwenId,
    class_type: '',
    key: 'fps',
    type: 'text',
    label: '真实帧率',
    value: '',
    disabled: !kind.video,
    hint: kind.video
      ? '留空就把文件真实帧率接上。填写后改用这个数。模型看到的时长 = 总帧数 / 帧率，和输出上限无关。'
      : '图片和标签反推不使用帧率。视频反推留空时用文件帧率，时长 = 总帧数 / 帧率。',
  };
  return [ note, ...limit, fps, ...rest ];
}

function durationSeconds(values) {
  const item = (values || []).find(entry => entry?.type === 'duration' || entry?.key === 'duration_sec');
  if (!item || item.value == null || item.value === '') return null;
  const seconds = Number(item.value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function captionFpsOverride(values) {
  const item = (values || []).find(entry => entry?.id === 'caption_fps');
  if (!item || item.disabled) return null;
  if (item.value == null || String(item.value).trim() === '') return null;
  const number = Number(item.value);
  if (!Number.isFinite(number) || number < 1 || number > 240) {
    const error = new Error('真实帧率需要在 1 到 240 之间，留空则用文件帧率');
    error.status = 400;
    throw error;
  }
  return Math.round(number * 1000) / 1000;
}

function applyCaptionTiming(graph, values) {
  let componentsId = '';
  let qwenId = '';
  Object.entries(graph || {}).forEach(([ id, node ]) => {
    if (node?.class_type === 'GetVideoComponents') componentsId = id;
    if (/AILab_QwenVL/i.test(node?.class_type || '')) qwenId = id;
  });
  if (!qwenId) return;
  const fps = captionFpsOverride(values);
  if (fps) graph[qwenId].inputs.fps = fps;
  else if (componentsId) graph[qwenId].inputs.fps = [ componentsId, 2 ];
}

function applyPreviewValues(apiJson, values) {
  const graph = JSON.parse(JSON.stringify(apiJson));
  (values || []).forEach(item => {
    if (!item || item.disabled || item.type === 'note' || item.type === 'duration' || item.key === 'duration_sec' || item.id === 'caption_fps' || item.id === 'caption_limit') return;
    if (item.type === 'image' || item.type === 'video') return;
    const node = graph[String(item.node_id)];
    if (!node?.inputs || Array.isArray(node.inputs[item.key])) return;
    if (item.type === 'number') {
      const number = Number(item.value);
      if (Number.isFinite(number)) node.inputs[item.key] = number;
      return;
    }
    node.inputs[item.key] = item.value == null ? '' : String(item.value);
  });
  applyCaptionTiming(graph, values);
  applyDuration(graph, durationSeconds(values));
  applyQwen21OutputSize(graph);
  return graph;
}

function snap32(value) {
  return Math.max(64, Math.round(Number(value) / 32) * 32);
}

function applyQwen21OutputSize(graph) {
  Object.values(graph || {}).forEach(node => {
    if (node?.class_type !== 'TextEncodeQwenImage21') return;
    const width = Number(node.inputs?.width);
    const height = Number(node.inputs?.height);
    if (!(width >= 64) || !(height >= 64)) return;
    node.inputs.width = snap32(width);
    node.inputs.height = snap32(height);
  });
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
  applyQwen21OutputSize,
  collectMedia,
  collectText,
  framesForDuration,
  readFps,
  isImageWorkflow,
  isVideoWorkflow,
  resolveImageSeeds,
  pinBatchSize,
  IMAGE_BATCH_MAX,
};
