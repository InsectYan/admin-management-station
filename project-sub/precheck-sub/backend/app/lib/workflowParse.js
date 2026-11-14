'use strict';

const MODEL_KEYS = [
  'ckpt_name', 'lora_name', 'vae_name', 'unet_name', 'clip_name',
  'clip_name1', 'clip_name2', 'model_name', 'control_net_name',
  'style_model_name', 'gligen_name', 'ipadapter_file',
];
const MODEL_EXT = /\.(safetensors|ckpt|gguf|pt|pth|bin|sft)$/i;
const CATALOG_NODES = new Set([
  'AILab_QwenVL',
  'AILab_QwenVL_Advanced',
  'AILab_QwenVL_GGUF',
  'AILab_QwenVL_GGUF_Advanced',
  'AILab_QwenVL_PromptEnhancer',
  'AILab_QwenVL_GGUF_PromptEnhancer',
]);

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(item => walk(item, visit));
    return;
  }
  visit(value);
  Object.values(value).forEach(item => walk(item, visit));
}

function parseApiWorkflow(apiJson) {
  if (!apiJson || typeof apiJson !== 'object' || Array.isArray(apiJson)) {
    const error = new Error('需要 ComfyUI API 格式 JSON');
    error.status = 400;
    throw error;
  }
  const nodes = [];
  const models = new Set();
  Object.entries(apiJson).forEach(([ id, node ]) => {
    if (!node || typeof node !== 'object' || !node.class_type) return;
    nodes.push(node.class_type);
    const inputs = node.inputs || {};
    Object.entries(inputs).forEach(([ key, input ]) => {
      if (typeof input !== 'string') return;
      if (CATALOG_NODES.has(node.class_type) && (key === 'model_name' || key === 'model') && !MODEL_EXT.test(input)) return;
      if (MODEL_KEYS.includes(key) || MODEL_EXT.test(input)) models.add(input);
    });
    if (!node.class_type) void id;
  });
  if (!nodes.length) {
    const error = new Error('JSON 里没有 class_type。请用 Save (API Format) 导出，不要用界面格式');
    error.status = 400;
    throw error;
  }
  return {
    required_nodes: [ ...new Set(nodes) ].sort(),
    required_models: [ ...models ].sort(),
  };
}

module.exports = { parseApiWorkflow };
