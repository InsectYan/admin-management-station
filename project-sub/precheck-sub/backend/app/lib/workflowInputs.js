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
    const mark = (link, role) => {
      const found = traceLoader(graph, link);
      if (!found || tagged.has(found.nodeId)) return;
      const width = Number(inputs.width);
      const height = Number(inputs.height);
      tagged.set(found.nodeId, {
        role,
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
    Object.entries(inputs).forEach(([ key, value ]) => {
      if (Array.isArray(value) && /^ref_images\.ref_image_\d+$/.test(key)) mark(value, 'reference');
    });
  });

  const images = [];
  Object.entries(graph).forEach(([ nodeId, node ]) => {
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
    else if (slot.role === 'end') slot.label = '尾帧';
    else if (slot.role === 'reference') slot.label = `参考图${suffix}`;
    else if (slot.role === 'mask') slot.label = `蒙版${suffix}`;
    else slot.label = `图片${suffix}`;
    slot.spec = specOf(slot);
  });
  images.sort((a, b) => {
    const order = { start: 0, end: 1, reference: 2, image: 3, mask: 4 };
    return (order[a.role] ?? 9) - (order[b.role] ?? 9) || Number(a.node_id) - Number(b.node_id);
  });
  return { positive: findPositive(graph), images };
}

function applyCallInputs(apiJson, { positive, imageNames } = {}) {
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
  Object.entries(imageNames || {}).forEach(([ slotId, filename ]) => {
    const slot = call.images.find(item => item.id === slotId);
    if (!slot || !filename) return;
    graph[slot.node_id].inputs[slot.key] = filename;
  });
  return graph;
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
    type: 'image',
    label: slot.label,
    value: '',
    spec: slot.spec,
    width: slot.width,
    height: slot.height,
  }));
  const durationAt = next.findIndex(field => field.type === 'duration');
  next.splice(durationAt >= 0 ? durationAt + 1 : 0, 0, ...imageFields);
  return next;
}

module.exports = {
  describeCallInputs,
  applyCallInputs,
  withCallFields,
};
