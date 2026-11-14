'use strict';

const PROMPT_KEYS = [ 'text', 'prompt', 'positive_prompt', 'caption', 'string', 'text_g', 'text_l', 'value' ];

function isLoader(classType) {
  return classType === 'LoadImage' || classType === 'LoadImageMask';
}

function promptKeysOf(node) {
  const inputs = node?.inputs || {};
  return PROMPT_KEYS.filter(key => typeof inputs[key] === 'string');
}

function traceLoader(graph, link) {
  let currentId = Array.isArray(link) ? String(link[0]) : '';
  const seen = new Set();
  let megapixels = null;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = graph[currentId];
    if (!node) return null;
    if (isLoader(node.class_type) && typeof node.inputs?.image === 'string') {
      return { nodeId: currentId, megapixels };
    }
    if (node.class_type === 'ImageScaleToTotalPixels') {
      const value = Number(node.inputs?.megapixels);
      if (Number.isFinite(value) && value > 0) megapixels = value;
    }
    const next = node.inputs?.image;
    if (!Array.isArray(next)) return null;
    currentId = String(next[0]);
  }
  return null;
}

function findPositive(graph) {
  const seeds = [];
  Object.values(graph || {}).forEach(node => {
    if (Array.isArray(node?.inputs?.positive)) seeds.push(node.inputs.positive);
    if (Array.isArray(node?.inputs?.conditioning)) seeds.push(node.inputs.conditioning);
  });
  for (const seed of seeds) {
    let currentId = String(seed[0]);
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = graph[currentId];
      if (!node) break;
      const keys = promptKeysOf(node);
      if (keys.length) {
        return {
          node_id: currentId,
          key: keys[0],
          keys,
          value: node.inputs[keys[0]],
        };
      }
      const next = node.inputs?.positive || node.inputs?.conditioning;
      if (!Array.isArray(next)) break;
      currentId = String(next[0]);
    }
  }
  return null;
}

function specOf(slot) {
  if (slot.width && slot.height) return `工作流目标 ${slot.width}×${slot.height}`;
  if (slot.megapixels) return `工作流会缩放到约 ${slot.megapixels} 百万像素`;
  return '按工作流里的缩放处理';
}

function describeCallInputs(apiJson) {
  const graph = apiJson || {};
  const tagged = new Map();
  Object.values(graph).forEach(node => {
    const inputs = node?.inputs || {};
    const mark = (link, role, expand, limit) => {
      const found = traceLoader(graph, link);
      if (!found || tagged.has(found.nodeId)) return;
      const width = Number(inputs.width);
      const height = Number(inputs.height);
      tagged.set(found.nodeId, {
        role,
        expand: expand || '',
        limit: Number(limit) > 1 ? Number(limit) : 1,
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null,
        megapixels: found.megapixels,
      });
    };
    if (Array.isArray(inputs.end_image)) mark(inputs.end_image, 'end');
    if (Array.isArray(inputs.last_frame)) mark(inputs.last_frame, 'end');
    if (Array.isArray(inputs.start_image)) mark(inputs.start_image, 'start');
    if (Array.isArray(inputs.first_frame)) mark(inputs.first_frame, 'start');
    if (node?.class_type === 'TextEncodeQwenImageEdit' && Array.isArray(inputs.image)) mark(inputs.image, 'reference');
    if (node?.class_type === 'TextEncodeQwenImageEditPlus') {
      [ 'image1', 'image2', 'image3' ].forEach(key => {
        if (Array.isArray(inputs[key])) mark(inputs[key], 'reference', 'edit-plus', 3);
      });
    }
    if (node?.class_type === 'TextEncodeQwenImage21') {
      Object.entries(inputs).forEach(([ key, value ]) => {
        if (Array.isArray(value) && /^images\.image_\d+$/.test(key)) mark(value, 'reference', 'qwen21', 8);
      });
    }
    if (node?.class_type === 'MiniMaxH3ReferenceToVideo') {
      Object.entries(inputs).forEach(([ key, value ]) => {
        if (Array.isArray(value) && /^ref_images\.ref_image_\d+$/.test(key)) mark(value, 'reference', 'h3-ref', 9);
      });
    }
    if (node?.class_type === 'FluxKontextImageScale' && Array.isArray(inputs.image)) mark(inputs.image, 'reference');
    if (node?.class_type === 'MiniMaxH3AddGuide' && Array.isArray(inputs.image)) {
      const idx = Number(inputs.frame_idx);
      mark(inputs.image, Number.isFinite(idx) && idx < 0 ? 'end' : 'start');
    }
    Object.entries(inputs).forEach(([ key, value ]) => {
      if (Array.isArray(value) && /^ref_images\.ref_image_\d+$/.test(key)) mark(value, 'reference');
    });
  });

  const images = [];
  Object.entries(graph).forEach(([ nodeId, node ]) => {
    if (node?.class_type === 'LoadVideo' && typeof node.inputs?.file === 'string') {
      images.push({
        id: `${nodeId}.file`,
        node_id: nodeId,
        key: 'file',
        role: 'video',
        width: null,
        height: null,
        megapixels: null,
        expand: '',
        limit: 1,
      });
      return;
    }
    if (!isLoader(node?.class_type) || typeof node.inputs?.image !== 'string') return;
    const meta = tagged.get(nodeId) || { role: node.class_type === 'LoadImageMask' ? 'mask' : 'image' };
    images.push({
      id: `${nodeId}.image`,
      node_id: nodeId,
      key: 'image',
      role: meta.role || 'image',
      width: meta.width || null,
      height: meta.height || null,
      megapixels: meta.megapixels || null,
      expand: meta.expand || '',
      limit: meta.limit || 1,
    });
  });
  const hasEnd = images.some(slot => slot.role === 'end');
  const roleCount = images.reduce((map, slot) => {
    map[slot.role] = (map[slot.role] || 0) + 1;
    return map;
  }, {});
  const seenRole = {};
  images.forEach(slot => {
    seenRole[slot.role] = (seenRole[slot.role] || 0) + 1;
    const many = roleCount[slot.role] > 1;
    const suffix = many ? String(seenRole[slot.role]) : '';
    if (slot.role === 'start') slot.label = hasEnd ? '首帧' : '起始图';
    else if (slot.role === 'end') {
      slot.label = '尾帧（可选）';
      slot.optional = true;
      slot.spec = slot.width && slot.height
        ? `可以不传。不传时只按首帧生成，目标 ${slot.width}×${slot.height}`
        : '可以不传。不传时只按首帧继续生成。';
    }
    else if (slot.role === 'reference') slot.label = `参考图${suffix}`;
    else if (slot.role === 'mask') slot.label = `蒙版${suffix}`;
    else if (slot.role === 'video') slot.label = `视频${suffix}`;
    else slot.label = `图片${suffix}`;
    if (slot.role === 'video') slot.spec = '上传 mp4、webm 或 mov。模型从视频里抽 16 帧反推。';
    else if (slot.role !== 'end') slot.spec = slot.limit > 1
      ? `最多 ${slot.limit} 张，按选择顺序作为参考图`
      : specOf(slot);
  });
  images.sort((a, b) => {
    const order = { start: 0, end: 1, reference: 2, image: 3, mask: 4 };
    return (order[a.role] ?? 9) - (order[b.role] ?? 9) || Number(a.node_id) - Number(b.node_id);
  });
  return { positive: findPositive(graph), negative: findNegative(graph), images };
}

function findNegative(graph) {
  const seeds = [];
  Object.values(graph || {}).forEach(node => {
    if (Array.isArray(node?.inputs?.negative)) seeds.push(node.inputs.negative);
  });
  for (const seed of seeds) {
    let currentId = String(seed[0]);
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = graph[currentId];
      if (!node) break;
      const keys = promptKeysOf(node);
      if (keys.length) {
        return { node_id: currentId, key: keys[0], keys, value: node.inputs[keys[0]] };
      }
      const next = node.inputs?.negative;
      if (!Array.isArray(next)) break;
      currentId = String(next[0]);
    }
  }
  for (const [ nodeId, node ] of Object.entries(graph || {})) {
    if (typeof node?.inputs?.negative_prompt === 'string') {
      return {
        node_id: nodeId,
        key: 'negative_prompt',
        keys: [ 'negative_prompt' ],
        value: node.inputs.negative_prompt,
      };
    }
  }
  return null;
}

function applySeed(graph, seed) {
  const number = Number(seed);
  if (!Number.isSafeInteger(number) || number < 0) return graph;
  Object.values(graph || {}).forEach(node => {
    const inputs = node?.inputs;
    if (!inputs) return;
    [ 'seed', 'noise_seed' ].forEach(key => {
      const current = inputs[key];
      if (Array.isArray(current) || current == null || typeof current === 'object') return;
      if (typeof current === 'number' || (typeof current === 'string' && current.trim() && Number.isFinite(Number(current)))) {
        inputs[key] = number;
      }
    });
  });
  return graph;
}

function applyCallInputs(apiJson, { positive, negative, imageNames } = {}) {
  const graph = JSON.parse(JSON.stringify(apiJson));
  const call = describeCallInputs(graph);
  if (positive != null) {
    if (!call.positive) {
      const error = new Error('工作流里没有正向提示词节点');
      error.status = 400;
      throw error;
    }
    const node = graph[call.positive.node_id];
    call.positive.keys.forEach(key => {
      node.inputs[key] = String(positive);
    });
  }
  const negativeText = negative != null ? String(negative).trim() : '';
  if (negativeText && call.negative) {
    const node = graph[call.negative.node_id];
    call.negative.keys.forEach(key => {
      node.inputs[key] = negativeText;
    });
  }
  Object.entries(imageNames || {}).forEach(([ slotId, filename ]) => {
    const slot = call.images.find(item => item.id === slotId);
    if (!slot || !filename) return;
    graph[slot.node_id].inputs[slot.key] = filename;
  });
  omitEmptyEnds(graph, imageNames, call.images);
  return graph;
}

function rewireGuide(graph, guideId, guide) {
  const upstream = guide.inputs?.positive;
  Object.values(graph).forEach(node => {
    if (!node?.inputs || node === guide) return;
    Object.entries(node.inputs).forEach(([ key, value ]) => {
      if (!Array.isArray(value) || String(value[0]) !== String(guideId)) return;
      if (Array.isArray(upstream)) node.inputs[key] = upstream.slice();
    });
  });
}

function omitEmptyEnds(graph, imageNames, images) {
  const pending = (images || []).filter(slot => slot.role === 'end' && !imageNames?.[slot.id]);
  pending.forEach(slot => {
    const loaderId = String(slot.node_id);
    const consumers = [];
    Object.entries(graph).forEach(([ id, node ]) => {
      if (!node?.inputs) return;
      Object.entries(node.inputs).forEach(([ key, value ]) => {
        if (Array.isArray(value) && String(value[0]) === loaderId) consumers.push({ id, key, node });
      });
    });
    consumers.forEach(({ id, key, node }) => {
      if (node.class_type === 'MiniMaxH3AddGuide') {
        rewireGuide(graph, id, node);
        delete graph[id];
      } else {
        delete node.inputs[key];
      }
    });
    delete graph[loaderId];
  });
}

function withCallFields(fields, apiJson) {
  const call = describeCallInputs(apiJson);
  const next = (fields || []).slice();
  if (call.positive) {
    const exists = next.find(field => field.node_id === call.positive.node_id && field.key === call.positive.key);
    if (exists) exists.label = '正向提示词';
    else {
      next.unshift({
        id: `${call.positive.node_id}.${call.positive.key}`,
        node_id: call.positive.node_id,
        key: call.positive.key,
        type: 'text',
        label: '正向提示词',
        value: call.positive.value,
      });
    }
  }
  const imageFields = call.images.map(slot => ({
    id: slot.id,
    node_id: slot.node_id,
    key: slot.key,
    type: slot.role === 'video' ? 'video' : 'image',
    label: slot.label,
    value: '',
    spec: slot.spec,
    optional: Boolean(slot.optional),
    width: slot.width,
    height: slot.height,
    limit: slot.limit || 1,
    expand: slot.expand || '',
  }));
  const durationAt = next.findIndex(field => field.type === 'duration');
  next.splice(durationAt >= 0 ? durationAt + 1 : 0, 0, ...imageFields);
  return next;
}

function nextNodeId(graph) {
  return String(Object.keys(graph).reduce((max, id) => {
    const value = Number(id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1);
}

function expandReferenceImages(graph, images, extras) {
  const byId = new Map((images || []).map(slot => [ slot.id, slot ]));
  Object.entries(extras || {}).forEach(([ slotId, filenames ]) => {
    const slot = byId.get(slotId);
    const files = (filenames || []).filter(Boolean);
    if (!slot?.expand || !files.length) return;
    files.forEach((filename, index) => {
      const loaderId = nextNodeId(graph);
      graph[loaderId] = { class_type: 'LoadImage', inputs: { image: filename } };
      const ordinal = index + 2;
      Object.values(graph).forEach(node => {
        const inputs = node?.inputs;
        if (!inputs) return;
        let key = '';
        if (slot.expand === 'edit-plus' && node.class_type === 'TextEncodeQwenImageEditPlus' && ordinal <= 3) {
          key = `image${ordinal}`;
        } else if (slot.expand === 'qwen21' && node.class_type === 'TextEncodeQwenImage21') {
          key = `images.image_${ordinal}`;
        } else if (slot.expand === 'h3-ref' && node.class_type === 'MiniMaxH3ReferenceToVideo') {
          key = `ref_images.ref_image_${ordinal - 1}`;
        }
        if (key && !inputs[key]) inputs[key] = [ loaderId, 0 ];
      });
    });
  });
  return graph;
}

module.exports = {
  describeCallInputs,
  applyCallInputs,
  applySeed,
  withCallFields,
  expandReferenceImages,
};
